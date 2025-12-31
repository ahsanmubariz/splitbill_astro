import { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Define the types for our data structures
type BillItem = {
  name: string;
  price: number;
  quantity: number;
};

type BillData = {
  items: BillItem[];
  tax: number;
  service_charge: number;
  total: number;
};

// The new, more detailed assignment structure
type Assignments = {
  [itemIndex: number]: {
    [personIndex: number]: number; // Maps personIndex to their assigned quantity
  };
};

type Stage = 'upload' | 'assign' | 'summary';

// Function to format numbers as IDR currency
const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Main component
export default function SplitBill() {
  const [stage, setStage] = useState<Stage>('upload');
  const [billData, setBillData] = useState<BillData | null>(null);

  // Handler for stage changes with validation
  const handleStageChange = (newStage: Stage) => {
    if (newStage === 'assign' && (!billData || billData.items.length === 0)) {
      setError('Please process a receipt first');
      return false;
    }
    if (newStage === 'summary' && people.length === 0) {
      setError('Please add at least one person');
      return false;
    }
    setStage(newStage);
    return true;
  };

  // Handler for when receipt processing completes
  const handleReceiptProcessed = (data: BillData) => {
    setBillData(data);
    if (window.trackReceiptProcessed) {
      window.trackReceiptProcessed(data.items.length);
    }
    return handleStageChange('assign');
  };
  const [people, setPeople] = useState<string[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [assignments, setAssignments] = useState<Assignments>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingToFirestore, setSavingToFirestore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Handler for file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFilePreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  // Handler for submitting the receipt image
  const handleProcessReceipt = async (e: React.FormEvent<HTMLFormElement>) => {
    if (window.trackReceiptProcessed) {
      window.trackReceiptProcessed(billData?.items.length || 0);
    }
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const file = formData.get('receipt') as File;
    if (!file || file.size === 0) {
      setError('Please select a receipt image to upload.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/process-receipt', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      setBillData(data);
      setStage('assign');
    } catch (err: any) {
      setError(err.message);
      setStage('upload');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for managing people
  const handleAddPerson = () => {
    if (newPersonName.trim() && !people.includes(newPersonName.trim())) {
      setPeople([...people, newPersonName.trim()]);
      setNewPersonName('');
    }
  };

  const handleRemovePerson = (indexToRemove: number) => {
    setPeople(prevPeople => prevPeople.filter((_, index) => index !== indexToRemove));

    setAssignments(prevAssignments => {
      const newAssignments: Assignments = {};
      Object.keys(prevAssignments).forEach(itemIndexStr => {
        const itemIndex = parseInt(itemIndexStr, 10);
        const personAssignments = prevAssignments[itemIndex];
        const newPersonAssignments: { [personIndex: number]: number } = {};

        Object.keys(personAssignments).forEach(personIndexStr => {
          const personIndex = parseInt(personIndexStr, 10);
          if (personIndex !== indexToRemove) {
            const newPersonIndex = personIndex > indexToRemove ? personIndex - 1 : personIndex;
            newPersonAssignments[newPersonIndex] = personAssignments[personIndex];
          }
        });

        if (Object.keys(newPersonAssignments).length > 0) {
          newAssignments[itemIndex] = newPersonAssignments;
        }
      });
      return newAssignments;
    });
  };

  // New handler for updating quantity assignments
  const updateAssignment = (itemIndex: number, personIndex: number, change: 1 | -1) => {
    setAssignments(prev => {
      const newAssignments = { ...prev };
      const itemAssignments = newAssignments[itemIndex] ? { ...newAssignments[itemIndex] } : {};
      const currentQty = itemAssignments[personIndex] || 0;
      let newQty = currentQty + change;

      if (newQty < 0) newQty = 0;

      // Calculate total assigned quantity for this item to check against available quantity
      const totalAssigned = Object.values(itemAssignments).reduce((sum, qty) => sum + qty, 0) - currentQty + newQty;
      const availableQty = billData?.items[itemIndex]?.quantity || 0;

      if (totalAssigned > availableQty) {
        // Don't update if it exceeds available quantity
        return prev;
      }

      if (newQty === 0) {
        delete itemAssignments[personIndex];
      } else {
        itemAssignments[personIndex] = newQty;
      }

      if (Object.keys(itemAssignments).length === 0) {
        delete newAssignments[itemIndex];
      } else {
        newAssignments[itemIndex] = itemAssignments;
      }

      return newAssignments;
    });
  };

  // Memoized calculation for the final summary
  const { summary, totalAssignedValue } = useMemo(() => {
    if (!billData || people.length === 0) {
      return { summary: [], totalAssignedValue: 0 };
    }

    const personTotals = Array(people.length).fill(0).map(() => ({
      items: [] as { name: string; price: number; quantity: number }[],
      total: 0,
    }));

    let currentTotalAssignedValue = 0;

    // Distribute item costs based on granular quantity
    billData.items.forEach((item, itemIndex) => {
      const itemAssignments = assignments[itemIndex];
      if (!itemAssignments) return;

      const unitPrice = item.price / item.quantity;

      Object.keys(itemAssignments).forEach(personIndexStr => {
        const personIndex = parseInt(personIndexStr, 10);
        const assignedQty = itemAssignments[personIndex];
        const costForPerson = unitPrice * assignedQty;

        if (personTotals[personIndex]) {
          personTotals[personIndex].total += costForPerson;
          personTotals[personIndex].items.push({ name: item.name, quantity: assignedQty, price: costForPerson });
          currentTotalAssignedValue += costForPerson;
        }
      });
    });

    // Distribute tax and service charge proportionally to each person's subtotal
    if (currentTotalAssignedValue > 0) {
      personTotals.forEach(person => {
        if (person.total > 0) {
          const proportion = person.total / currentTotalAssignedValue;
          const taxShare = (billData.tax || 0) * proportion;
          const serviceShare = (billData.service_charge || 0) * proportion;
          person.total += taxShare + serviceShare;
        }
      });
    }

    return { summary: personTotals, totalAssignedValue: currentTotalAssignedValue };
  }, [billData, people, assignments]);

  const saveBillToFirestore = async () => {
    if (!billData || people.length === 0) return;

    setSavingToFirestore(true);
    try {
      await addDoc(collection(db, 'bills'), {
        items: billData.items,
        assignments,
        people,
        total: billData.total,
        createdAt: new Date(),
        tax: billData.tax,
        service_charge: billData.service_charge
      });
      alert('Bill saved to Firestore successfully!');
    } catch (error) {
      console.error('Error saving bill:', error);
      alert('Failed to save bill to Firestore');
    } finally {
      setSavingToFirestore(false);
    }
  };

  const handleStartOver = () => {
    setStage('upload');
    setBillData(null);
    setPeople([]);
    setNewPersonName('');
    setAssignments({});
    setError(null);
    setFilePreview(null);
    const fileInput = document.getElementById('receipt-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // Render logic based on the current stage
  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-6 bg-slate-50 rounded-2xl shadow-lg border border-slate-200">
      {/* Stage: Upload */}
      {stage === 'upload' && (
        <div className="text-center pt-4">
          <form onSubmit={handleProcessReceipt}>
            <div className="mb-4">
              <label htmlFor="receipt-upload" className="block w-full cursor-pointer bg-white border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-blue-500 hover:bg-blue-50 transition-colors">
                {filePreview ? (
                  <img src={filePreview} alt="Receipt preview" className="max-h-48 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <span className="text-slate-600 font-medium">Klik untuk mengunggah struk</span>
                    <span className="text-sm text-slate-400 mt-1">PNG, JPG, atau GIF</span>
                  </div>
                )}
              </label>
              <input id="receipt-upload" name="receipt" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center">
              {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
              {isLoading ? 'Menganalisis Struk...' : 'Proses Struk'}
            </button>
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </form>
        </div>
      )}

      {/* Stage: Assign Items */}
      {stage === 'assign' && billData && (
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Tetapkan Item</h2>
          {/* People Management */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6">
            <h3 className="font-semibold text-slate-700 mb-2">Siapa Saja yang Ikut?</h3>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()} placeholder="Masukkan nama..." className="flex-grow p-2 border border-slate-300 rounded-md" />
              <button onClick={handleAddPerson} className="bg-blue-500 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-600">+</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {people.map((person, index) => (
                <div key={index} className="flex items-center bg-slate-100 rounded-full px-3 py-1 text-sm">
                  <span className="text-slate-700">{person}</span>
                  <button onClick={() => handleRemovePerson(index)} className="ml-2 text-slate-500 hover:text-red-500">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {billData.items.map((item, itemIndex) => {
              const assignedQtys = assignments[itemIndex] ? Object.values(assignments[itemIndex]).reduce((a, b) => a + b, 0) : 0;
              const remainingQty = item.quantity - assignedQtys;
              return (
                <div key={itemIndex} className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <span className="font-medium text-slate-800">{item.name}</span>
                      <span className="ml-2 text-sm text-slate-500">(Total: {item.quantity}, Sisa: {remainingQty})</span>
                    </div>
                    <span className="font-mono text-slate-600">{formatIDR(item.price)}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {people.map((person, personIndex) => (
                      <div key={personIndex} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-700">{person}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateAssignment(itemIndex, personIndex, -1)} className="w-7 h-7 bg-slate-200 text-slate-700 rounded-full font-bold hover:bg-slate-300">-</button>
                          <span className="w-8 text-center font-medium">{assignments[itemIndex]?.[personIndex] || 0}</span>
                          <button onClick={() => updateAssignment(itemIndex, personIndex, 1)} className="w-7 h-7 bg-slate-200 text-slate-700 rounded-full font-bold hover:bg-slate-300">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <button onClick={() => setStage('summary')} className="mt-6 w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-all">
            Hitung & Tampilkan Ringkasan
          </button>
        </div>
      )}

      {/* Stage: Summary */}
      {stage === 'summary' && billData && (
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Ringkasan Tagihan</h2>
          <div className="space-y-4">
            {people.map((person, index) => {
              const personSummary = summary[index];
              if (!personSummary || personSummary.total <= 0) return null;

              const taxAndServiceShare = (personSummary.total / (totalAssignedValue || 1)) * (billData.tax + billData.service_charge);

              return (
                <div key={index} className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-blue-700">{person}</h3>
                    <span className="text-xl font-bold text-slate-800">{formatIDR(personSummary.total)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 text-sm space-y-1">
                    {personSummary.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="flex justify-between text-slate-600">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{formatIDR(item.price)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-500 italic">
                      <span>Bagian Pajak/Layanan</span>
                      <span>{formatIDR(taxAndServiceShare)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 p-4 bg-slate-100 rounded-lg flex justify-between items-center">
            <span className="font-bold text-lg text-slate-800">Total Keseluruhan</span>
            <span className="font-bold text-lg text-slate-800">{formatIDR(billData.total)}</span>
          </div>
          <div className="flex gap-4 mt-6">
            <button
              onClick={saveBillToFirestore}
              disabled={savingToFirestore}
              className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {savingToFirestore ? 'Menyimpan...' : 'Simpan ke Cloud'}
            </button>
            <button
              onClick={handleStartOver}
              className="flex-1 bg-slate-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-700 transition-all"
            >
              Mulai Lagi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
