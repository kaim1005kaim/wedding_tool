import type { Metadata } from 'next';
import RoomRuntime from '../../../components/room-runtime';
import AwardsView from '../../../components/awards-view';

type PageProps = {
  params: { roomId: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Awards ${params.roomId} | wedding_tool`
  };
}

export default function AwardsPage({ params }: PageProps) {
  return (
    <RoomRuntime roomId={params.roomId}>
      <AwardsView roomId={params.roomId} />
    </RoomRuntime>
  );
}
