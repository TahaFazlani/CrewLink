export const DELIVERY_ADAPTER = Symbol('DELIVERY_ADAPTER');

export interface DeliveryAdapter {
  deliver(memberId: string, announcementId: string): Promise<void>;
}
