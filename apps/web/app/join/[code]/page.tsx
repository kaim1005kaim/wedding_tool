import type { Metadata } from 'next';
import JoinPageClient from './page-client';

type PageProps = {
  params: { code: string };
};

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Join ${params.code.toUpperCase()} | wedding_tool`
  };
}

export default function JoinPage({ params }: PageProps) {
  return <JoinPageClient code={params.code} />;
}
