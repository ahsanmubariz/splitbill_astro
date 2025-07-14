import type { APIRoute } from 'astro';

// Define the expected JSON structure from the LLM
interface BillData {
  items: { name: string; price: number; quantity: number }[];
  tax: number;
  service_charge: number;
  total: number;
}

// A platform-agnostic function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const POST: APIRoute = async (context) => {
    const { request } = context;
  // Check for the correct Content-Type header before processing
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    console.error(`Server Error: Invalid Content-Type. Expected 'multipart/form-data' but received: ${contentType}`);
    return new Response(
      JSON.stringify({
        error: `Server requires 'multipart/form-data' but received '${contentType}'. This is likely an issue with the client-side fetch request.`,
      }),
      { status: 415 } // 415 Unsupported Media Type is the correct status code
    );
  }
  
  const openRouterApiKey = import.meta.env.PRIVATE_OPENROUTER_API_KEY;

  if (!openRouterApiKey) {
    console.error("Server Error: OPENROUTER_API_KEY is not set in .env file.");
    return new Response(
      JSON.stringify({
        error: 'API key for OpenRouter is not configured on the server.',
      }),
      { status: 500 }
    );
  }

  try {
    // Get the image file from the form data
    const formData = await request.formData();
    const file = formData.get('receipt') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No receipt image provided.' }), { status: 400 });
    }

    // Convert image to base64 using the robust function
    const buffer = await file.arrayBuffer();
    const base64Image = arrayBufferToBase64(buffer);
    const mimeType = file.type;

    const prompt = `
      You are an expert receipt scanner and data extractor for Indonesian receipts.
      Analyze the following receipt image and extract all individual items. For each item, identify its name, quantity, and the total price for that line item.
      Also, identify any tax (pajak/PPN), service charge (biaya layanan), and the grand total.
      Respond with ONLY a valid JSON object following this exact structure, using numbers for prices without any currency symbols or thousands separators:
      {
        "items": [{ "name": "Nasi Goreng", "quantity": 2, "price": 50000 }],
        "tax": 5000,
        "service_charge": 2500,
        "total": 57500
      }
      If a quantity is not explicitly listed for an item, assume the quantity is 1. The 'price' field should always be the total for that line (e.g., quantity * unit price).
      If tax or service charge are not found, set their value to 0. Do not include any other text, explanations, or markdown formatting in your response.
    `;

    // Call the OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen2.5-vl-32b-instruct:free", 
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API Error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Failed to process receipt with AI model. Status: ${response.status}` }), { status: 502 }); // 502 Bad Gateway is more appropriate here
    }

    const data = await response.json();
    const messageContent = data.choices[0]?.message?.content;

    if (!messageContent) {
      console.error("LLM Error: AI model returned an empty response content.", data);
      return new Response(JSON.stringify({ error: 'AI model returned an empty response.' }), { status: 500 });
    }

    // The LLM can sometimes wrap the JSON in ```json ... ```. We need to extract it.
    const jsonMatch = messageContent.match(/```json\n([\s\S]*?)\n```/);
    const jsonStringToParse = jsonMatch ? jsonMatch[1] : messageContent;

    try {
      const parsedJson: BillData = JSON.parse(jsonStringToParse);
      return new Response(JSON.stringify(parsedJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error("LLM Error: Failed to parse JSON from LLM response:", messageContent);
      return new Response(JSON.stringify({ error: 'Failed to parse the data from the receipt. The AI gave a response in the wrong format.' }), { status: 500 });
    }

  } catch (error: any) {
    // This catch block will now likely not be hit for the content-type error,
    // but remains for other potential errors during formData parsing.
    console.error('Internal Server Error in process-receipt:', error);
    return new Response(JSON.stringify({ error: 'An unexpected internal server error occurred.', details: error.message }), { status: 500 });
  }
};
