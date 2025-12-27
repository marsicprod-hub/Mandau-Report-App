
export enum ImpactStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  ON_CHECK = 'ON CHECK'
}

export interface UpdateEntry {
  time: string;
  text: string;
  textEn: string;
}

export interface ImpactItem {
  name: string;
  status: ImpactStatus;
}

export interface SubImpact {
  name: string;
  status: ImpactStatus;
}

export interface ImpactCustomer {
  name: string;
  subs: SubImpact[];
}

export interface ReportData {
  siteA: string;
  siteB: string;
  ttNumber: string;
  impactList: ImpactItem[];
  occurTime: string;
  dispatchTime: string;
  pic: string;
  segmentPM: string;
  rootcause: string;
  cutPoint: string;
  updates: UpdateEntry[];
  impactCustomers: ImpactCustomer[];
}

export interface TabInfo {
  id: number;
  title: string;
  isUjb: boolean;
  data: ReportData;
}

export interface PicEntry {
  region: string;
  role: string;
  name: string;
  phone: string;
}

export interface SegmentEntry {
  segmentId: string;
  region: string;
  pic: string;
}
