/**
 * ハードコードされたクイズデータ
 * 本番で使用するクイズは固定されているため、データベースではなくコードで管理
 */

export type HardcodedQuiz = {
  id: string;
  ord: number;
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
  imageUrl?: string;
  isBuzzer?: boolean; // 早押しクイズかどうか
};

/**
 * 結婚式で使用するクイズ一覧
 */
export const WEDDING_QUIZZES: HardcodedQuiz[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    ord: 1,
    question: '渋谷駅にあるハチ公像、実際は何の犬？',
    choices: ['柴犬', '秋田犬', '豆柴', 'コーギー'],
    answerIndex: 1, // B.秋田犬
    imageUrl: '/quiz-images/quiz1.jpg'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    ord: 2,
    question: '新婦が長年推しているflumpool。\n今年でファン歴何年目でしょう？',
    choices: ['3年目', '7年目', '14年目', '20年目'],
    answerIndex: 2, // C.14年目
    imageUrl: '/quiz-images/quiz2.jpg'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    ord: 3,
    question: '普段、新郎が新婦を呼んでいる名前は？',
    choices: ['みずき', 'えっちゃん', 'とりとり', 'とりっぴー'],
    answerIndex: 3, // D.とりっぴー
    imageUrl: '/quiz-images/quiz3.jpg'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    ord: 4,
    question: '新郎はダイエットして最大何キロ減量した？',
    choices: ['5kg', '15kg', '25kg', '減らしてない'],
    answerIndex: 2, // C.25kg
    imageUrl: '/quiz-images/quiz4.png'
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    ord: 5,
    question: '普段サプライズをしたことがない新郎が、プロポーズのとき\n"いつもと違って"してくれたことは何だったでしょう？',
    choices: [
      '初めて手紙を書いて気持ちを伝えてくれた',
      'バラの花束を持って登場した',
      'サプライズでflumpoolの曲を歌ってくれた',
      'フラッシュモブをした'
    ],
    answerIndex: 0, // A.初めて手紙を書いて気持ちを伝えてくれた
    imageUrl: '/quiz-images/quiz5.png'
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    ord: 6,
    question: '今日（11月23日）は何の日？',
    choices: ['勤労感謝の日', 'いい夫婦の日', '文化の日', '体育の日'],
    answerIndex: 0, // A.勤労感謝の日
    imageUrl: '/quiz-images/quiz6.png',
    isBuzzer: true
  }
];

/**
 * クイズの順番を取得（設定で変更可能）
 */
export function getQuizOrder(): number[] {
  // デフォルトは1,2,3,4,5,6の順番
  // TODO: 設定画面で順番を変更できるようにする場合、ここを動的に取得
  return [1, 2, 3, 4, 5, 6];
}

/**
 * 指定された順番でクイズを取得
 */
export function getOrderedQuizzes(order?: number[]): HardcodedQuiz[] {
  const quizOrder = order || getQuizOrder();
  return quizOrder
    .map(ord => WEDDING_QUIZZES.find(q => q.ord === ord))
    .filter((q): q is HardcodedQuiz => q !== undefined);
}

/**
 * IDでクイズを取得
 */
export function getQuizById(id: string): HardcodedQuiz | undefined {
  return WEDDING_QUIZZES.find(q => q.id === id);
}

/**
 * ordでクイズを取得
 */
export function getQuizByOrd(ord: number): HardcodedQuiz | undefined {
  return WEDDING_QUIZZES.find(q => q.ord === ord);
}

/**
 * 早押しクイズを取得
 */
export function getBuzzerQuiz(): HardcodedQuiz | undefined {
  return WEDDING_QUIZZES.find(q => q.isBuzzer === true);
}
