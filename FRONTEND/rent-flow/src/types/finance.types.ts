export interface FinanceDashboardPeriod {
  start_date: string;
  end_date: string;
  is_custom: boolean;
}

export interface FinanceRevenueMonth {
  month: string;
  revenue: number;
}

export interface FinanceDashboard {
  currency: string;
  period: FinanceDashboardPeriod;
  revenues: {
    current_month: number;
    year_to_date: number;
    last_6_months: FinanceRevenueMonth[];
  };
  rent: {
    expected_current_month: number;
    collected_current_month: number;
    outstanding_current_month: number;
  };
  payments: {
    count_current_month: number;
  };
  overdue: {
    leases_count: number;
    amount: number;
  };
  occupancy: {
    total_properties: number;
    occupied_properties: number;
    vacant_properties: number;
    rate_percent: number;
  };
  leases: {
    active_count: number;
  };
}
