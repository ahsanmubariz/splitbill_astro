# Firebase Analytics Implementation Guide

## Overview

This project uses Firebase Analytics to track user behavior and app performance. The implementation follows Google's 2026 best practices for Firebase Analytics.

## Architecture

### Files Structure

```
src/
├── lib/
│   ├── firebase.ts          # Firebase initialization
│   └── analytics.ts         # Analytics utility functions
├── components/
│   └── SplitBill.tsx        # Main component with analytics tracking
└── pages/
    └── index.astro          # Entry point with analytics initialization
```

## Analytics Events

### Tracked Events

All events follow Firebase naming conventions (snake_case, max 40 characters):

#### 1. **page_view**
- **When**: User lands on the page
- **Parameters**:
  - `page_path`: Current page path
  - `page_title`: Page title
  - `page_location`: Full URL

#### 2. **session_started**
- **When**: User starts a new session
- **Parameters**:
  - `timestamp`: Session start time

#### 3. **receipt_upload_start**
- **When**: User selects a receipt image
- **Parameters**:
  - `file_size_kb`: File size in kilobytes
  - `file_type`: MIME type of the file

#### 4. **receipt_processed**
- **When**: Receipt is successfully processed by AI
- **Parameters**:
  - `item_count`: Number of items extracted
  - `total_amount`: Total bill amount
  - `processing_time_ms`: Time taken to process
  - `currency`: Currency code (IDR)

#### 5. **receipt_processing_failed**
- **When**: Receipt processing fails
- **Parameters**:
  - `error_message`: Error description (max 100 chars)
  - `error_type`: Type of error (e.g., 'api_error')

#### 6. **person_added**
- **When**: User adds a person to split the bill
- **Parameters**:
  - `total_people`: Total number of people after addition

#### 7. **person_removed**
- **When**: User removes a person from the split
- **Parameters**:
  - `total_people`: Total number of people after removal

#### 8. **item_assigned**
- **When**: User assigns an item to a person
- **Parameters**:
  - `item_name`: Name of the item (max 100 chars)
  - `person_name`: Name of the person (max 100 chars)
  - `quantity`: Quantity assigned

#### 9. **stage_changed**
- **When**: User navigates between app stages
- **Parameters**:
  - `new_stage`: Stage navigated to (upload/assign/summary)
  - `previous_stage`: Previous stage

#### 10. **bill_saved**
- **When**: Bill is successfully saved to Firestore
- **Parameters**:
  - `item_count`: Number of items
  - `people_count`: Number of people
  - `total_amount`: Total bill amount
  - `currency`: Currency code (IDR)

#### 11. **bill_save_failed**
- **When**: Saving bill to Firestore fails
- **Parameters**:
  - `error_message`: Error description (max 100 chars)

#### 12. **session_completed**
- **When**: User completes the entire flow and saves the bill
- **Parameters**:
  - `session_duration_ms`: Total time from start to completion
  - `item_count`: Number of items processed
  - `people_count`: Number of people in the split

#### 13. **error_occurred**
- **When**: General errors occur
- **Parameters**:
  - `error_message`: Error description (max 100 chars)
  - `error_context`: Context where error occurred (max 100 chars)

## User Properties

User properties are set once per session for segmentation:

- `app_version`: Current app version
- `platform`: Platform type (web)
- `language`: User language (id)

## Best Practices Implemented

### 1. **Event Naming**
- ✅ Snake_case naming convention
- ✅ Max 40 characters per event name
- ✅ Verb-first naming (e.g., `receipt_processed` not `processed_receipt`)
- ✅ No special characters or spaces

### 2. **Event Parameters**
- ✅ Max 25 parameters per event
- ✅ Parameter names max 40 characters
- ✅ String values max 100 characters
- ✅ Automatic sanitization of parameters

### 3. **Type Safety**
- ✅ TypeScript types for all events
- ✅ Proper typing for Analytics instance
- ✅ Type-safe parameter objects

### 4. **Performance**
- ✅ Analytics only loaded in production
- ✅ Lazy loading of analytics module
- ✅ No blocking of main thread

### 5. **Privacy**
- ✅ No personally identifiable information (PII) tracked
- ✅ Only aggregate data collected
- ✅ Compliant with privacy regulations

## Usage Examples

### Tracking a Custom Event

```typescript
import { trackEvent } from '../lib/analytics';

trackEvent('custom_event_name', {
  parameter1: 'value1',
  parameter2: 123,
});
```

### Tracking Receipt Processing

```typescript
import { trackReceiptProcessed } from '../lib/analytics';

trackReceiptProcessed(
  itemCount: 5,
  total: 150000,
  processingTime: 2500
);
```

### Setting User Properties

```typescript
import { setAnalyticsUserProperties } from '../lib/analytics';

setAnalyticsUserProperties({
  user_type: 'premium',
  preferred_language: 'id',
});
```

## Testing Analytics

### Development Mode

In development, analytics events are logged to the console:

```
[Analytics] receipt_processed { item_count: 5, total_amount: 150000, ... }
```

### Production Mode

In production, events are sent to Firebase Analytics.

### Firebase DebugView

To test analytics in real-time:

1. Enable debug mode in your browser:
   ```javascript
   localStorage.setItem('debug_mode', true);
   ```

2. Open Firebase Console → Analytics → DebugView

3. Perform actions in the app and see events in real-time

## Analytics Dashboard

### Key Metrics to Monitor

1. **User Engagement**
   - Session count
   - Average session duration
   - Pages per session

2. **Conversion Funnel**
   - Upload → Process → Assign → Save
   - Drop-off rates at each stage

3. **Performance**
   - Average receipt processing time
   - Error rates
   - Success rates

4. **User Behavior**
   - Average items per receipt
   - Average people per split
   - Most common bill amounts

## Troubleshooting

### Analytics Not Working

1. **Check Firebase Config**: Ensure all environment variables are set in `.env`
2. **Check Console**: Look for analytics warnings in browser console
3. **Check Production Mode**: Analytics only runs in production (`import.meta.env.PROD`)
4. **Check Network**: Verify requests to Firebase in Network tab

### Events Not Appearing

1. **Wait 24 Hours**: Firebase Analytics has a delay for non-real-time data
2. **Use DebugView**: For real-time testing
3. **Check Event Names**: Ensure they follow naming conventions
4. **Check Parameters**: Verify parameters are within limits

## Future Enhancements

- [ ] Add conversion tracking for specific goals
- [ ] Implement A/B testing with Firebase Remote Config
- [ ] Add custom dimensions for deeper segmentation
- [ ] Integrate with Google Analytics 4 for advanced reporting
- [ ] Add BigQuery export for custom analysis
- [ ] Implement predictive analytics for user behavior

## References

- [Firebase Analytics Documentation](https://firebase.google.com/docs/analytics)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [Firebase Best Practices](https://firebase.google.com/docs/analytics/best-practices)
