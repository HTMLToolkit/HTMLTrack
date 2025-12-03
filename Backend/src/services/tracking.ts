interface TrackingResult {
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  lastUpdate: string;
  destination?: string;
  estimatedDelivery?: string;
  events?: Array<{
    timestamp: string;
    location: string;
    status: string;
  }>;
}

interface TrackingService {
  trackPackage(trackingNumber: string, carrier: string, apiKey: string): Promise<TrackingResult>;
}

const normalizeCarrier = (carrier: string): string | undefined => {
  // 17track carrier codes - using numeric carrier IDs
  // See: https://api.17track.net/en/doc for carrier list
  const carrierMap: Record<string, number> = {
    'UPS': 100003,
    'FedEx': 100002,
    'USPS': 21051,
    'DHL': 100001,
    'Amazon Logistics': 190271,
  };
  
  const code = carrierMap[carrier];
  return code ? String(code) : undefined; // Return undefined for 'Other' to auto-detect
};

const formatTrackingResult = (data: any, trackingNumber: string, carrier: string): TrackingResult => {
  // v2.2 API response format: data.accepted[0].track_info
  const accepted = data.data?.accepted?.[0];
  const trackInfo = accepted?.track_info;

  if (!accepted) {
    // Check if it's in rejected list
    const rejected = data.data?.rejected?.[0];
    if (rejected) {
      throw new Error(`Tracking rejected: ${rejected.error?.message || 'Invalid tracking number'}`);
    }
    throw new Error('No tracking information found');
  }

  // If no track info yet, return pending status
  if (!trackInfo) {
    return {
      trackingNumber,
      carrier,
      status: 'pending',
      lastUpdate: new Date().toISOString(),
      events: []
    };
  }

  // Map status string to our status types
  const statusMap: Record<string, 'pending' | 'in_transit' | 'delivered' | 'failed'> = {
    'InfoReceived': 'pending',
    'InTransit': 'in_transit',
    'OutForDelivery': 'in_transit',
    'AvailableForPickup': 'in_transit',
    'Delivered': 'delivered',
    'Exception': 'failed',
    'Expired': 'failed',
    'NotFound': 'pending',
  };

  const latestStatus = trackInfo.latest_status?.status || 'NotFound';
  const status = statusMap[latestStatus] || 'pending';

  // Get events from tracking providers
  const providers = trackInfo.tracking?.providers || [];
  const allEvents = providers.flatMap((provider: any) => 
    (provider.events || []).map((event: any) => ({
      timestamp: event.time_utc || event.time_iso || new Date().toISOString(),
      location: event.location || 'Unknown',
      status: event.description || 'Update'
    }))
  );

  const latestEvent = trackInfo.latest_event;

  const result: TrackingResult = {
    trackingNumber,
    carrier,
    status,
    lastUpdate: latestEvent?.time_utc || new Date().toISOString(),
    events: allEvents
  };

  // Get destination from recipient address
  const recipientAddress = trackInfo.shipping_info?.recipient_address;
  if (recipientAddress?.city || recipientAddress?.country) {
    result.destination = [recipientAddress.city, recipientAddress.state, recipientAddress.country]
      .filter(Boolean)
      .join(', ');
  }

  // Estimated delivery date
  const estimatedDelivery = trackInfo.time_metrics?.estimated_delivery_date;
  if (estimatedDelivery?.from) {
    result.estimatedDelivery = estimatedDelivery.from;
  }

  return result;
};

export const trackingService: TrackingService = {
  async trackPackage(trackingNumber: string, carrier: string, apiKey: string): Promise<TrackingResult> {
    const normalized = trackingNumber.toUpperCase().trim();
    const carrierCode = normalizeCarrier(carrier);

    try {
      // Register the tracking number first
      const registerBody: { number: string; carrier?: number }[] = [{
        number: normalized,
      }];
      
      // Only add carrier if it's not 'Other' (auto-detect)
      if (carrierCode) {
        registerBody[0].carrier = Number(carrierCode);
      }

      const response = await fetch('https://api.17track.net/track/v2.2/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': apiKey
        },
        body: JSON.stringify(registerBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[17Track Register Error]', response.status, errorText);
        throw new Error(`Tracking service error: ${response.status}`);
      }

      // Wait a moment for the tracking to be registered, then query
      await new Promise(resolve => setTimeout(resolve, 1000));

      const trackResponse = await fetch('https://api.17track.net/track/v2.2/gettrackinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': apiKey
        },
        body: JSON.stringify([{ number: normalized }])
      });

      if (!trackResponse.ok) {
        const errorText = await trackResponse.text();
        console.error('[17Track GetInfo Error]', trackResponse.status, errorText);
        throw new Error(`Tracking service error: ${trackResponse.status}`);
      }

      const data = await trackResponse.json();

      return formatTrackingResult(data, normalized, carrier);
    } catch (error) {
      console.error('[17Track API Error]', error);
      if (error instanceof Error && (
        error.message.startsWith('Tracking service error') ||
        error.message.startsWith('Tracking rejected') ||
        error.message.startsWith('No tracking')
      )) {
        throw error;
      }
      throw new Error('Failed to fetch tracking information. Please try again later.');
    }
  }
};