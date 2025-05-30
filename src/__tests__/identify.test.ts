import request from "supertest";
import app from "../app";
import { supabase } from "../utils/supabase/client";

describe("POST /identify", () => {
  beforeAll(async () => {
    // No table creation here. Table should exist in your test Supabase DB.
  });

  afterEach(async () => {
    // Clean up test data after each test run
    await supabase.from("contacts").delete().neq("id", 0);
  });

  afterAll(async () => {
    // Optionally, close connections or cleanup resources if needed
  });

  it("should return 400 if neither email nor phoneNumber is provided", async () => {
    const res = await request(app).post("/identify").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "email or phone number required",
    });
  });

  it("should create a new primary contact", async () => {
    const res = await request(app).post("/identify").send({
      email: "new@fluxkart.com",
      phoneNumber: "1000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.primaryContactId).toBeDefined();

    const { data, error } = await supabase.from("contacts").select("*");
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].email).toBe("new@fluxkart.com");
  });
});
