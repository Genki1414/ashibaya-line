// docs/ashiba_platform_仕様まとめ.md 4章のデータモデルに対応する型定義。

export type VerifyStatus = "none" | "reviewing" | "verified" | "expired" | "rejected";

export type CreditLevel = "unverified" | "bronze" | "silver" | "gold" | "platinum";

export interface CompanyMetrics {
  completed: number;
  paidCount: number;
  onTimeCount: number;
  lateCount: number;
  unpaid: number;
  avgPayDays: number;
  lastTrade: string | null;
  continuous: number;
}

export interface Company {
  id: string;
  name: string;
  region: string;
  contact: string;
  areas: string[];
  works: string[];
  registered: string;
  verify: Record<string, VerifyStatus>;
  metrics: CompanyMetrics;
}

export type JobType = "support" | "contract";
export type PayType = "progress" | "lump";
export type ClosingDay = "末" | "25" | "20" | "15" | "10";
export type PayTerm = "翌月末" | "翌月25" | "翌月15" | "翌々月末" | "当月末払い";

export interface Project {
  id: string;
  stage: "recruiting" | "matched";
  name: string;
  jobType: JobType;
  region: string;
  address: string;
  start: string;
  end: string;
  assemblyStart: string | null;
  assemblyEnd: string | null;
  dismantleStart: string | null;
  dismantleEnd: string | null;
  need: number | null;
  price: number;
  payType: PayType;
  closing: ClosingDay;
  payterm: PayTerm;
  work: string;
  belongings: string;
  deadline: string;
  posted: string;
  guaranteed: boolean;
  primeId: string;
  applicants: string[];
}

export type WorkStatus = "waiting" | "working" | "reported" | "rework" | "confirmed";
export type BillStatus = "none" | "invoiced" | "checked" | "paid" | "deposited";

export interface DailySession {
  date: string;
  kind: "start" | "end";
  people: number | null;
  content: string;
}

export interface WorkReport {
  date: string;
  days: number;
  people: number | null;
  content: string;
  photos: number;
}

export interface Rework {
  text: string;
  date: string;
}

export interface Invoice {
  amount: number;
  date: string;
  dueDate: string;
  bank: string;
  note: string;
}

export interface Payment {
  date: string;
  amount: number;
  method: string;
  note: string;
}

export interface Deposit {
  date: string;
  amount: number;
  diff: boolean;
  note: string;
}

export interface Phase {
  work: WorkStatus;
  startDate: string | null;
  endDate: string | null;
  sessions: DailySession[];
  report: WorkReport | null;
  rework: Rework | null;
  bill: BillStatus;
  inv: Invoice | null;
  pay: Payment | null;
  dep: Deposit | null;
}

export interface Issue {
  text: string;
  date: string;
  resolved: boolean;
}

export interface Consultation {
  text: string;
  date: string;
}

export interface TimelineEntry {
  ts: string;
  companyName: string;
  actor: string;
  label: string;
  comment: string | null;
}

export interface OrderDoc {
  at: string;
  date: string;
}

export interface ScheduleChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface ScheduleNotice {
  at: string;
  changes: ScheduleChange[];
  ack: boolean;
}

export interface AshibaseLink {
  linked: boolean;
  at: string | null;
}

export interface Transaction {
  id: string;
  projectName: string;
  jobType: JobType;
  region: string;
  address: string;
  start: string;
  end: string;
  assemblyStart: string | null;
  assemblyEnd: string | null;
  dismantleStart: string | null;
  dismantleEnd: string | null;
  need: number | null;
  amount: number;
  payType: PayType;
  assemblyAmount: number | null;
  dismantleAmount: number | null;
  closing: ClosingDay;
  payterm: PayTerm;
  primeId: string;
  partnerId: string;
  guaranteed: boolean;
  chatKey: string;
  order: OrderDoc | null;
  orderAck: OrderDoc | null;
  status: "completed" | null;
  ph: {
    assembly: Phase;
    dismantle: Phase;
  };
  issues: Issue[];
  consultations: Consultation[];
  ashibase: AshibaseLink;
  scheduleNotice: ScheduleNotice | null;
  timeline: TimelineEntry[];
}

export interface ChatMessage {
  at: string;
  from: string;
  text: string;
}

export interface Chat {
  key: string; // `${projectId}:${companyId}`
  primeId: string;
  partnerId: string;
  title: string;
  messages: ChatMessage[];
}

export type ActingRole = "prime" | "partner";
