export const playbackSpeeds=[0.5,0.75,0.9,1,1.1,1.25,1.5] as const;
export const speedLabel=(speed:number)=>`${String(speed).replace('.',',')}×`;
