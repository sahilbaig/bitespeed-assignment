import express from "express";

import { identifyController } from "../controllers/identify";
const router = express.Router();

router.post("/", identifyController);

export default router;
