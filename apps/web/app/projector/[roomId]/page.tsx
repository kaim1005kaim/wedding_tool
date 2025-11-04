import type { Metadata, Viewport } from 'next';
import RoomRuntime from '../../../components/room-runtime';
import ProjectorView from '../../../components/projector-view';

type PageProps = {
  params: { roomId: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Projector ${params.roomId} | wedding_tool`
  };
}

export const viewport: Viewport = {
  width: 1280,
  height: 800,
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function ProjectorPage({ params }: PageProps) {
  return (
    <RoomRuntime roomId={params.roomId}>
      <ProjectorView roomId={params.roomId} />
    </RoomRuntime>
  );
}
