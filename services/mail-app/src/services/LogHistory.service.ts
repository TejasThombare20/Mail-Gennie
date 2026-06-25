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

  async getActiveSessionStatuses(user_id: string) {
    try {
      return await this.historyRepository.getActiveSessionStatuses(user_id);
    } catch (error) {
      logger.error("Error in getActiveSessionStatuses service method", { error });
      return [];
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

  async getSessionDetails(sessionId: string, user_id: string) {
    try {
      return await this.historyRepository.getSessionDetails(sessionId, user_id);
    } catch (error) {
      logger.error("Error in getSessionDetails service method", { error });
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

  async updateSessionActions(
    sessionId: string,
    user_id: string,
    actions: Record<string, any>
  ) {
    try {
      return await this.historyRepository.updateSessionActions(
        sessionId,
        user_id,
        actions
      );
    } catch (error) {
      logger.error("Error in updateSessionActions service method", { error });
      return false;
    }
  }

  async setSessionOutreach(
    sessionId: string,
    user_id: string,
    outreach: any[]
  ) {
    try {
      return await this.historyRepository.setSessionOutreach(
        sessionId,
        user_id,
        outreach
      );
    } catch (error) {
      logger.error("Error in setSessionOutreach service method", { error });
      return false;
    }
  }

  async setLogReplies(
    logId: number,
    user_id: string,
    mailReplied: any[]
  ) {
    try {
      return await this.historyRepository.setLogReplies(logId, user_id, mailReplied);
    } catch (error) {
      logger.error("Error in setLogReplies service method", { error });
      return false;
    }
  }

  async getEmailLogs(
    user_id: string,
    last_sent_at: string | null,
    search: string | null = null
  ): Promise<EmailLog[] | null> {
    try {
      const emailLogsData = await this.historyRepository.getUserLogs(
        user_id,
        last_sent_at,
        search
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
