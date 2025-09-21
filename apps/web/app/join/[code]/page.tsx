import type { Metadata } from 'next';
import RoomRuntime from '../../../components/room-runtime';
import JoinRoom from '../../../components/join-room';

type PageProps = {
  params: { code: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Join ${params.code.toUpperCase()} | wedding_tool`
  };
}

export default function JoinPage({ params }: PageProps) {
  return (
    <RoomRuntime roomId={params.code}>
      <JoinRoom code={params.code} />
    </RoomRuntime>
  );
}
