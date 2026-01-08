import { analytics } from './firebase';
import { logEvent, setUserProperties } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';

/**
 * Centralized Firebase Analytics utility
 * Following Firebase Analytics best practices for 2026
 */

// Type definitions for better type safety
export type AnalyticsEventName =
    | 'page_view'
    | 'receipt_upload_start'
    | 'receipt_processed'
    | 'receipt_processing_failed'
    | 'person_added'
    | 'person_removed'
    | 'item_assigned'
    | 'stage_changed'
    | 'bill_saved'
    | 'bill_save_failed'
    | 'session_started'
    | 'session_completed'
    | 'error_occurred';

export interface AnalyticsEvent {
    name: AnalyticsEventName;
    params?: Record<string, any>;
}

/**
 * Track a custom event with Firebase Analytics
 * @param eventName - Name of the event (max 40 chars, snake_case)
 * @param params - Event parameters (max 25 params, each key max 40 chars)
 */
export const trackEvent = (eventName: AnalyticsEventName, params?: Record<string, any>) => {
    if (!analytics) {
        console.warn('Analytics not initialized');
        return;
    }

    try {
        // Sanitize params to meet Firebase requirements
        const sanitizedParams = params ? sanitizeParams(params) : {};
        logEvent(analytics as Analytics, eventName as string, sanitizedParams);

        if (import.meta.env.DEV) {
            console.log(`[Analytics] ${eventName}`, sanitizedParams);
        }
    } catch (error) {
        console.error('Error tracking event:', error);
    }
};

/**
 * Track page view
 */
export const trackPageView = (pagePath: string, pageTitle: string) => {
    trackEvent('page_view', {
        page_path: pagePath,
        page_title: pageTitle,
        page_location: typeof window !== 'undefined' ? window.location.href : '',
    });
};

/**
 * Track receipt upload start
 */
export const trackReceiptUploadStart = (fileSize: number, fileType: string) => {
    trackEvent('receipt_upload_start', {
        file_size_kb: Math.round(fileSize / 1024),
        file_type: fileType,
    });
};

/**
 * Track successful receipt processing
 */
export const trackReceiptProcessed = (itemCount: number, total: number, processingTime?: number) => {
    trackEvent('receipt_processed', {
        item_count: itemCount,
        total_amount: total,
        processing_time_ms: processingTime,
        currency: 'IDR',
    });
};

/**
 * Track receipt processing failure
 */
export const trackReceiptProcessingFailed = (errorMessage: string, errorType?: string) => {
    trackEvent('receipt_processing_failed', {
        error_message: errorMessage.substring(0, 100), // Limit to 100 chars
        error_type: errorType || 'unknown',
    });
};

/**
 * Track person added to split
 */
export const trackPersonAdded = (totalPeople: number) => {
    trackEvent('person_added', {
        total_people: totalPeople,
    });
};

/**
 * Track person removed from split
 */
export const trackPersonRemoved = (totalPeople: number) => {
    trackEvent('person_removed', {
        total_people: totalPeople,
    });
};

/**
 * Track item assignment
 */
export const trackItemAssigned = (itemName: string, personName: string, quantity: number) => {
    trackEvent('item_assigned', {
        item_name: itemName.substring(0, 100),
        person_name: personName.substring(0, 100),
        quantity: quantity,
    });
};

/**
 * Track stage change in the app flow
 */
export const trackStageChanged = (newStage: string, previousStage: string) => {
    trackEvent('stage_changed', {
        new_stage: newStage,
        previous_stage: previousStage,
    });
};

/**
 * Track bill saved to Firestore
 */
export const trackBillSaved = (itemCount: number, peopleCount: number, total: number) => {
    trackEvent('bill_saved', {
        item_count: itemCount,
        people_count: peopleCount,
        total_amount: total,
        currency: 'IDR',
    });
};

/**
 * Track bill save failure
 */
export const trackBillSaveFailed = (errorMessage: string) => {
    trackEvent('bill_save_failed', {
        error_message: errorMessage.substring(0, 100),
    });
};

/**
 * Track session start
 */
export const trackSessionStarted = () => {
    trackEvent('session_started', {
        timestamp: Date.now(),
    });
};

/**
 * Track session completion (user finished splitting bill)
 */
export const trackSessionCompleted = (totalTime: number, itemCount: number, peopleCount: number) => {
    trackEvent('session_completed', {
        session_duration_ms: totalTime,
        item_count: itemCount,
        people_count: peopleCount,
    });
};

/**
 * Track general errors
 */
export const trackError = (errorMessage: string, errorContext?: string) => {
    trackEvent('error_occurred', {
        error_message: errorMessage.substring(0, 100),
        error_context: errorContext?.substring(0, 100) || 'general',
    });
};

/**
 * Set user properties for segmentation
 */
export const setAnalyticsUserProperties = (properties: Record<string, string>) => {
    if (!analytics) {
        console.warn('Analytics not initialized');
        return;
    }

    try {
        setUserProperties(analytics as Analytics, properties);

        if (import.meta.env.DEV) {
            console.log('[Analytics] User properties set:', properties);
        }
    } catch (error) {
        console.error('Error setting user properties:', error);
    }
};

/**
 * Sanitize parameters to meet Firebase requirements
 * - Max 25 parameters
 * - Parameter names max 40 characters
 * - String values max 100 characters
 */
const sanitizeParams = (params: Record<string, any>): Record<string, any> => {
    const sanitized: Record<string, any> = {};
    const entries = Object.entries(params).slice(0, 25); // Max 25 params

    for (const [key, value] of entries) {
        const sanitizedKey = key.substring(0, 40); // Max 40 chars for key

        if (typeof value === 'string') {
            sanitized[sanitizedKey] = value.substring(0, 100); // Max 100 chars for string values
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitized[sanitizedKey] = value;
        } else {
            sanitized[sanitizedKey] = String(value).substring(0, 100);
        }
    }

    return sanitized;
};

/**
 * Initialize analytics tracking for the session
 * Call this when the app loads
 */
export const initializeAnalytics = () => {
    if (typeof window === 'undefined') return;

    // Track session start
    trackSessionStarted();

    // Set initial user properties
    setAnalyticsUserProperties({
        app_version: '1.0.0',
        platform: 'web',
        language: 'id',
    });

    // Track page view
    trackPageView(window.location.pathname, document.title);
};
