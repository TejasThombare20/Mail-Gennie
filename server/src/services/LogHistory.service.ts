import { HistoryRepository } from "../repository/history.repository";
import { EmailLog } from "../types/historyLogs.types";
import logger from "../utils/logger";

export class LogHistoryService {
  constructor(private historyRepository: HistoryRepository) {}

  async getDashboardStats(user_id: string) {
    try {
      return await this.historyRepository.getDashboardStats(user_id);
    } catch (error) {
      logger.error("Error in getDashboardStats service method", { error });
      return null;
    }
  }

  async getDashboardSessionsPaginated(
    user_id: string,
    opts: {
      page: number;
      pageSize: number;
      search?: string | null;
      status?: string | null;
      company?: string | null;
    }
  ) {
    try {
      return await this.historyRepository.getDashboardSessionsPaginated(
        user_id,
        opts
      );
    } catch (error) {
      logger.error("Error in getDashboardSessionsPaginated service method", {
        error,
      });
      return null;
    }
  }

  async getEmailsByCompanyDate(user_id: string) {
    try {
      return await this.historyRepository.getEmailsByCompanyDate(user_id);
    } catch (error) {
      logger.error("Error in getEmailsByCompanyDate service method", { error });
      return null;
    }
  }

  async getSessionForOutreach(sessionId: string, user_id: string) {
    try {
      return await this.historyRepository.getSessionForOutreach(sessionId, user_id);
    } catch (error) {
      logger.error("Error in getSessionForOutreach service method", { error });
      return null;
    }
  }

  async updateSessionOutreachDetails(
    sessionId: string,
    user_id: string,
    details: Record<string, any>
  ) {
    try {
      return await this.historyRepository.updateSessionOutreachDetails(
        sessionId,
        user_id,
        details
      );
    } catch (error) {
      logger.error("Error in updateSessionOutreachDetails service method", { error });
      return false;
    }
  }

  async setSessionInterviewers(
    sessionId: string,
    user_id: string,
    interviewers: any[]
  ) {
    try {
      return await this.historyRepository.setSessionInterviewers(
        sessionId,
        user_id,
        interviewers
      );
    } catch (error) {
      logger.error("Error in setSessionInterviewers service method", { error });
      return false;
    }
  }

  async updateLogUserActions(
    logId: number,
    user_id: string,
    actions: Record<string, any>
  ) {
    try {
      return await this.historyRepository.updateLogUserActions(logId, user_id, actions);
    } catch (error) {
      logger.error("Error in updateLogUserActions service method", { error });
      return false;
    }
  }

  async getEmailLogs(
    user_id: string,
    last_sent_at: string | null
  ): Promise<EmailLog[] | null> {
    try {
      const emailLogsData = await this.historyRepository.getUserLogs(
        user_id,
        last_sent_at
      );

      if (!emailLogsData) {
        return null;
      }
      return emailLogsData;
    } catch (error) {
      logger.error("Error in getUserLogs service method", { error });
      return null;
    }
  }
}
