import { Request, Response } from "express";

export const identifyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    res.status(400).json({ error: "email or phoneNumber required" });
    return;
  }

  try {
    // const result = await identifyService(email, phoneNumber);
    const result = "abcd";
    res.json({ contact: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
