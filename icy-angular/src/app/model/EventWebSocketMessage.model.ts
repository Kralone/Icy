export interface EventWebSocketMessageModel {
  message: string;
  event: {
    id: string;
    type: string;
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    createdAt: string;
    finished: boolean;
  };
  action: 'ADD' | 'UPDATE' | 'DELETE';
}
