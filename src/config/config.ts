import dotenv from 'dotenv';

export class CustomConfig {
    public port: number;

    constructor() {
        dotenv.config();
        this.port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    }

}


