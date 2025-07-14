// Initialize analytics when Firebase loads
let analytics;

async function initAnalytics() {
  const { analytics: a } = await import('../lib/firebase');
  const { logEvent } = await import('firebase/analytics');
  analytics = a;
  
  // Track initial page view
  if (analytics) {
    logEvent(analytics, 'page_view', {
      page_title: document.title,
      page_path: window.location.pathname,
      page_location: window.location.href
    });
  }
  
  return { logEvent };
}

// Track stage changes
window.trackStageChange = async (stage, previousStage) => {
  const { logEvent } = await initAnalytics();
  if (analytics) {
    logEvent(analytics, 'stage_change', { 
      stage, 
      previous_stage: previousStage 
    });
  }
};

// Track receipt processing
window.trackReceiptProcessed = async (itemCount, receiptType) => {
  const { logEvent } = await initAnalytics();
  if (analytics) {
    logEvent(analytics, 'receipt_processed', {
      item_count: itemCount,
      receipt_type: receiptType || 'unknown'
    });
  }
};

// Initialize analytics
initAnalytics();