// Extend Window interface for analytics functions
interface Window {
  trackStageChange?: (stage: string, previousStage: string) => Promise<void>;
  trackReceiptProcessed?: (itemCount: number, receiptType?: string) => Promise<void>;
}