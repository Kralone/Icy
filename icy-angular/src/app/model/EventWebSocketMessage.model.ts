import {EventType} from './event-type.model';

export interface EventWebSocketMessageModel {
  message: string;
  event: {
    id: string;
    type: EventType;
    title: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    createdAt: string;
    finished: boolean;
  };
  action: 'ADD' | 'UPDATE' | 'DELETE';
}
