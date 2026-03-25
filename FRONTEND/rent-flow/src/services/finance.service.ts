import { apiClient } from "@/lib/axios";
import type { FinanceDashboard } from "@/types/finance.types";

export interface FinanceDashboardParams {
  agencyId: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchFinanceDashboard(
  params: FinanceDashboardParams
): Promise<FinanceDashboard> {
  const { agencyId, startDate, endDate } = params;
  const query: Record<string, string> = {};

  if (startDate && endDate) {
    query.start_date = startDate;
    query.end_date = endDate;
  }

  const { data } = await apiClient.get<FinanceDashboard>(
    "/dashboard/finance/",
    {
      params: query,
      headers: {
        "X-Agency-ID": agencyId,
      },
    }
  );

  return data;
}
