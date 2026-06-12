import express, { Express, Request, Response , Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import logger from './utils/logger';
import pool, { connectDB } from './config/database';
import { UserRepository } from './repository/user.repository';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { createAuthRouter } from './routes/auth.routes';
import { TokenRepository } from './repository/token.repository';
import { TemplateRepository } from './repository/template.repository';
import { TemplateService } from './services/template.service';
import { EmailService } from './services/email.service';
import { TemplateController } from './controllers/templelate.controller';
import { createTemplateRouter } from './routes/template.routes';
import { HistoryRepository } from './repository/history.repository';
import { createAttachmentRouter } from './routes/attachments.routes';
import { AttachmentController } from './controllers/attachment.controller';
import { AttachmentService } from './services/attachment.service';
import { AttachmentRepository } from './repository/attachment.repository';
import { MediaStorage } from './config/media-storage';
import { EmailController } from './controllers/email.controller';
import { createEmailRouter } from './routes/email.routes';
import { LogHistoryService } from './services/LogHistory.service';
import { LogHistoryController } from './controllers/logHistory.controller';
import { createLogHistoryRouter } from './routes/logHistory.routes';
import { SentEmailRecordsRepository } from './repository/sentEmailRecords.repository';
import { SentEmailRecordsService } from './services/sentEmailRecords.service';
import { SentEmailRecordsController } from './controllers/sentEmailRecords.controller';
import { createSentEmailRecordsRouter } from './routes/sentEmailRecords.routes';
import { BounceScanService } from './services/bounceScan.service';
import { BounceScanController } from './controllers/bounceScan.controller';
import { createBounceScanRouter } from './routes/bounceScan.routes';
import { startBounceScanCron } from './cron/bounceScan.cron';
import { EmailEnqueueService } from './services/emailEnqueue.service';
import { AgentEnrichmentService } from './services/agentEnrichment.service';
import { runMigrations as runGraphileMigrations } from 'graphile-worker';
import { env, WatchManager, SessionRepository, EmailLogRepository, GraphileJobQueue } from '@app/shared';

dotenv.config();

const app: Application = express();


app.use(cookieParser());
app.use(cors({
  origin : process.env.CLIENT_URL,
  credentials: true,

}));
app.use(express.json());

// HTTP request logging - logs method, url, status, response time
const morganStream = {
  write: (message: string) => logger.http(message.trim()),
};
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

connectDB();

// Ensure the graphile_worker schema (incl. the add_job function) exists so the
// transactional enqueue in EmailEnqueueService works even before the
// queue-service has booted. Safe + idempotent to run on every startup.
runGraphileMigrations({ connectionString: env.databaseUrl })
  .then(() => logger.info('graphile-worker schema ready'))
  .catch((err) => logger.error('graphile-worker migration failed', { error: err?.message }));

const firebaseStorage = new MediaStorage();

 const userRepository = new UserRepository(pool);
 const tokenRepository = new TokenRepository(pool);
 const templateRepository = new TemplateRepository(pool);
 const historyRepository = new HistoryRepository(pool)
 const attachmentsRepository = new AttachmentRepository(pool)
 const logHistoryRepository = new HistoryRepository(pool)
 const sentEmailRecordsRepository = new SentEmailRecordsRepository(pool)
 const sessionRepository = new SessionRepository(pool)
 const emailLogRepository = new EmailLogRepository(pool)
 const jobQueue = new GraphileJobQueue(pool)

// Auto-arms Gmail watches at login when GMAIL_PUBSUB_TOPIC is set (no-op otherwise).
const watchManager = new WatchManager();
const authService = new AuthService(userRepository, tokenRepository, watchManager);
const templateService = new TemplateService(templateRepository,attachmentsRepository);
const attachmentService = new AttachmentService(attachmentsRepository ,firebaseStorage);
const emailService = new EmailService(tokenRepository, templateRepository,historyRepository,attachmentsRepository,attachmentService,sentEmailRecordsRepository );
const emailEnqueueService = new EmailEnqueueService(emailService, sessionRepository, emailLogRepository, jobQueue)
const agentEnrichmentService = new AgentEnrichmentService()
const logHistoryService = new LogHistoryService(logHistoryRepository)
const sentEmailRecordsService = new SentEmailRecordsService(sentEmailRecordsRepository)
const bounceScanService = new BounceScanService(tokenRepository, historyRepository)


const authController = new AuthController(authService, userRepository);
const templateController = new TemplateController(templateService, emailService, attachmentService);
const attachmentController = new AttachmentController(attachmentService);
const emailController = new EmailController(emailEnqueueService, agentEnrichmentService, sessionRepository)
const logHistoryController = new LogHistoryController(logHistoryService)
const sentEmailRecordsController = new SentEmailRecordsController(sentEmailRecordsService)
const bounceScanController = new BounceScanController(bounceScanService)



app.get('/', (req: Request, res: Response) => {
  res.send('mail-app server is running!');
});


app.use('/api/auth', createAuthRouter(authController));
app.use('/api/templates', createTemplateRouter(templateController));
app.use('/api/files',createAttachmentRouter(attachmentController))
app.use('/api/email',createEmailRouter(emailController))
app.use('/api/loghistory', createLogHistoryRouter(logHistoryController))
app.use('/api/sent-records', createSentEmailRecordsRouter(sentEmailRecordsController))
app.use('/api/bounce-scan', createBounceScanRouter(bounceScanController))

// Start the bounce scan cron job (every 10 minutes)
startBounceScanCron(bounceScanService);

const port = process.env.PORT || 8000;
  app.listen(port, () => {
  logger.info(`mail-app server is running at http://localhost:${port}`);
});
