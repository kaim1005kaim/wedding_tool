import type { Metadata } from 'next';
import RoomRuntime from '../../../components/room-runtime';
import AdminRoom from '../../../components/admin-room';

type PageProps = {
  params: { roomId: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Admin ${params.roomId} | wedding_tool`
  };
}

export default function AdminPage({ params }: PageProps) {
  return (
    <RoomRuntime roomId={params.roomId}>
      <AdminRoom roomId={params.roomId} />
    </RoomRuntime>
  );
}
