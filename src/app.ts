import express from "express";
import dotenv from "dotenv";
dotenv.config();

import identifyRouter from "./routes/identify";

const app = express();
app.use(express.json());
app.get("/", (_, res) => {
  res.send("Bitespeed server is running");
});

app.use("/identify", identifyRouter);

export default app;
