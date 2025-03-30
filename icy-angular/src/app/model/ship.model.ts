export interface Ship {
  id: number;
  name: string;
  imageUrl: string;
  brand: {
    name: string;
    imageUrl?: string;
  };
  focus?: string;
  crew?: string;
  scu?: number;
  size?: string;
  flightReady?: boolean;
}
