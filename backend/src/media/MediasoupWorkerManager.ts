import * as mediasoup from "mediasoup";
type Worker = mediasoup.types.Worker;
import os from "os";
import logger from "../config/logger";

export class MediasoupWorkerManager {
  private numCores = os.cpus().length;
  private workers: Worker[] = [];
  private nextWorkerIndex: number = 0;
  private workerCount: number = this.numCores / 2;

  constructor() {
    logger.media.info("CPU cores available", { cores: this.numCores });
  }

  public async init() {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: "warn",
        logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMaxPort: 49999,
        rtcMinPort: 40000,
      });

      worker.on("died", () => {
        logger.media.error("Mediasoup worker has died - exiting process");
        process.exit(1);
      });

      this.workers.push(worker);
      logger.media.info("Mediasoup worker created", { workerId: i });
    }
  }

  public getNextWorker() {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }
}