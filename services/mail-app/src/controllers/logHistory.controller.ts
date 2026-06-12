import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { LogHistoryService } from "../services/LogHistory.service";
import logger from "../utils/logger";

export class LogHistoryController {

    constructor (private logHistoryService: LogHistoryService) {

    }

getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;
        logger.info("Fetching dashboard stats", { user_id });

        const stats = await this.logHistoryService.getDashboardStats(user_id);

        if (!stats) {
            res.status(404).json({ message: "Unable to fetch dashboard stats", error: "Failed to fetch stats", success: false });
            return;
        }

        res.status(200).json({ data: stats, message: "Dashboard stats fetched successfully", success: true });
    } catch (error) {
        logger.error("Error fetching dashboard stats", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to fetch dashboard stats", success: false });
    }
}

getDashboardSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;

        const page = parseInt((req.query.page as string) || "1", 10);
        const pageSize = parseInt((req.query.pageSize as string) || "10", 10);
        const search = (req.query.search as string) || null;
        const status = (req.query.status as string) || null;
        const company = (req.query.company as string) || null;

        logger.info("Fetching paginated dashboard sessions", {
            user_id, page, pageSize, search, status, company,
        });

        const result = await this.logHistoryService.getDashboardSessionsPaginated(user_id, {
            page, pageSize, search, status, company,
        });

        if (!result) {
            res.status(404).json({ message: "Unable to fetch sessions", error: "Failed to fetch sessions", success: false });
            return;
        }

        res.status(200).json({ data: result, message: "Sessions fetched successfully", success: true });
    } catch (error) {
        logger.error("Error fetching paginated dashboard sessions", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to fetch sessions", success: false });
    }
}

getEmailsByCompanyDate = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;
        logger.info("Fetching emails-by-company-date for bar graph", { user_id });

        const data = await this.logHistoryService.getEmailsByCompanyDate(user_id);

        if (!data) {
            res.status(404).json({ message: "Unable to fetch chart data", error: "Failed to fetch chart data", success: false });
            return;
        }

        res.status(200).json({ data, message: "Chart data fetched successfully", success: true });
    } catch (error) {
        logger.error("Error fetching emails-by-company-date", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to fetch chart data", success: false });
    }
}

getSessionForOutreach = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;
        const sessionId = req.params.sessionId;

        const session = await this.logHistoryService.getSessionForOutreach(sessionId, user_id);

        if (!session) {
            res.status(404).json({ message: "Session not found", error: "Session not found", success: false });
            return;
        }

        res.status(200).json({ data: session, message: "Session fetched successfully", success: true });
    } catch (error) {
        logger.error("Error fetching session for outreach", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to fetch session", success: false });
    }
}

updateSessionOutreach = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;
        const sessionId = req.params.sessionId;
        // Merge a partial actions object (namespaced, e.g. { outreach: [...] }).
        const actions = req.body?.actions ?? req.body ?? {};

        const ok = await this.logHistoryService.updateSessionActions(sessionId, user_id, actions);

        if (!ok) {
            res.status(404).json({ message: "Session not found or not updated", error: "Update failed", success: false });
            return;
        }

        res.status(200).json({ message: "Session actions saved successfully", success: true });
    } catch (error) {
        logger.error("Error updating session actions", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to save session actions", success: false });
    }
}

setSessionOutreach = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;
        const sessionId = req.params.sessionId;
        // New body shape: { outreach: [...] }. Replaces actions.outreach wholesale.
        const outreach = Array.isArray(req.body?.outreach) ? req.body.outreach : [];

        const ok = await this.logHistoryService.setSessionOutreach(sessionId, user_id, outreach);

        if (!ok) {
            res.status(404).json({ message: "Session not found or not updated", error: "Update failed", success: false });
            return;
        }

        res.status(200).json({ message: "Outreach saved successfully", success: true });
    } catch (error) {
        logger.error("Error setting session outreach", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to save outreach", success: false });
    }
}

updateLogActions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user_id = req.user?.userId!;
        const logId = parseInt(req.params.logId, 10);
        // New body shape: { mail_replied: [...] }. Replaces user_actions.mail_replied.
        const mailReplied = Array.isArray(req.body?.mail_replied) ? req.body.mail_replied : [];

        if (Number.isNaN(logId)) {
            res.status(400).json({ message: "Invalid log id", error: "Invalid log id", success: false });
            return;
        }

        const ok = await this.logHistoryService.setLogReplies(logId, user_id, mailReplied);

        if (!ok) {
            res.status(404).json({ message: "Log not found or not updated", error: "Update failed", success: false });
            return;
        }

        res.status(200).json({ message: "Recipient replies saved successfully", success: true });
    } catch (error) {
        logger.error("Error updating log replies", { error });
        res.status(500).json({ message: "Internal Server Error", error: "Failed to save replies", success: false });
    }
}

getUserEmailLogs = async (req : AuthRequest , res : Response)  : Promise<void> =>{

    try {
        const user_id = req.user?.userId!

        const last_sent_at  = req.params.last_sent_at || null

        logger.info("Fetching email logs", { user_id, last_sent_at })
        
        const userHistoryLogData = await this.logHistoryService.getEmailLogs(user_id ,last_sent_at)

        if(!userHistoryLogData){
            res.status(404).json({ message : "not able to fetch the user's data ", error : "falied to fetch log history", success : false })
            return;  
        }

        res.status(200).json({data: userHistoryLogData , message : "User log history fetch successfully" , success : true})


    } catch (error) {
        res.status(500).json({ message  : "Internal Server Error" , error : "failed to fetch user log history" , success : false })
        return;
    }
}

}