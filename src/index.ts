import express from "express";

const app = express();
app.use(express.json());

app.get("/", (_, res) => {
  res.send("Bitespeed server is running");
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
