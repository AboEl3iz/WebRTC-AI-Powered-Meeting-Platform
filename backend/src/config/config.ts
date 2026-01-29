import dotenv from 'dotenv';

export class CustomConfig {
    public port: number;
    public dbUrl: string ;

    constructor() {
        dotenv.config();
        this.port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
        this.dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/myapp';
    }

}


