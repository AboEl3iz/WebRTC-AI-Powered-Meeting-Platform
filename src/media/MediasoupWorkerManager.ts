import * as mediasoup from "mediasoup";
type Worker = mediasoup.types.Worker;
import os from "os";
import { th } from "zod/v4/locales";
export class MediasoupWorkerManager {
  private numCores = os.cpus().length;
  private workers: Worker[] = [];
  private nextWorkerIndex: number = 0;
  private workerCount: number = 2;
  constructor(){
    console.log(`💻 Number of CPU cores available: ${this.numCores}`);
  }

  public async init() {
    for (let i = 0; i < this.workerCount; i++) {
        const worker = await mediasoup.createWorker({
            logLevel: "warn",
            rtcMaxPort: 40000,
            rtcMinPort: 49999,
        });

        worker.on("died", () => {
            console.error("Mediasoup worker has died");
            process.exit(1);
        });

        this.workers.push(worker);
        console.log(`🚀 Mediasoup worker ${i} created`);
    }
  }

  public getNextWorker () {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;


  }
}