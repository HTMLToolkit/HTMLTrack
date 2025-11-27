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

export const trackingService: TrackingService = {
  async trackPackage(trackingNumber: string, carrier: string, apiKey: string): Promise<TrackingResult> {
    const normalized = trackingNumber.toUpperCase().trim();

    try {
      const response = await fetch('https://api.17track.net/track/v2/trackinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          tracking_number: normalized,
          carrier_code: this.normalizeCarrier(carrier)
        })
      });

      if (!response.ok) {
        throw new Error(`17Track API error: ${response.status}`);
      }

      const data = await response.json();

      return this.formatTrackingResult(data, normalized, carrier);
    } catch (error) {
      console.error('[17Track API Error]', error);
      throw new Error('Failed to fetch tracking information from 17Track');
    }
  },

  normalizeCarrier(carrier: string): string {
    const carrierMap: Record<string, string> = {
      'UPS': 'ups',
      'FedEx': 'fedex',
      'USPS': 'usps',
      'DHL': 'dhl',
      'Amazon Logistics': 'amazoncn',
      'Other': 'other'
    };
    return carrierMap[carrier] || carrier.toLowerCase();
  },

  formatTrackingResult(data: any, trackingNumber: string, carrier: string): TrackingResult {
    const trackInfo = data.data?.[0];
    
    if (!trackInfo) {
      throw new Error('No tracking information found');
    }

    const statusMap: Record<number, 'pending' | 'in_transit' | 'delivered' | 'failed'> = {
      0: 'pending',
      1: 'in_transit',
      2: 'delivered',
      3: 'failed',
      4: 'in_transit',
      5: 'failed'
    };

    const events = (trackInfo.events || []).map((event: any) => ({
      timestamp: new Date(event.time * 1000).toISOString(),
      location: event.location || 'Unknown',
      status: event.status_text || event.status || 'Update'
    }));

    const lastEvent = events[events.length - 1];

    return {
      trackingNumber,
      carrier,
      status: statusMap[trackInfo.status] || 'pending',
      lastUpdate: lastEvent?.timestamp || new Date().toISOString(),
      destination: trackInfo.dest_city || undefined,
      estimatedDelivery: trackInfo.estimated_delivery 
        ? new Date(trackInfo.estimated_delivery * 1000).toISOString() 
        : undefined,
      events
    };
  }
};