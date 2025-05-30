import request from "supertest";
import app from "../app";
import { supabase } from "../utils/supabase/client";

describe("POST /identify", () => {
  beforeAll(async () => {});

  afterEach(async () => {
    await supabase.from("contacts").delete().neq("id", 0);
  });

  it("should return 400 if neither email nor phoneNumber is provided", async () => {
    const res = await request(app).post("/identify").send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "email or phone number required",
    });
  });

  it("should create a new primary contact if no match found", async () => {
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

  it("should return existing contact if exact match exists", async () => {
    const { data: inserted } = await supabase
      .from("contacts")
      .insert({
        email: "existing@fluxkart.com",
        phone_number: "2000000000",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    const res = await request(app).post("/identify").send({
      email: "existing@fluxkart.com",
      phoneNumber: "2000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.primaryContactId).toBe(inserted?.id);
    expect(res.body.contact.emails).toEqual(["existing@fluxkart.com"]);
    expect(res.body.contact.phoneNumbers).toEqual(["2000000000"]);
    expect(res.body.contact.secondaryContactIds).toEqual([]);
  });

  it("should create a secondary contact if email is new but phoneNumber matches primary", async () => {
    const { data: primary } = await supabase
      .from("contacts")
      .insert({
        email: "primary@fluxkart.com",
        phone_number: "3000000000",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    const res = await request(app).post("/identify").send({
      email: "secondary@fluxkart.com",
      phoneNumber: "3000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.primaryContactId).toBe(primary?.id);
    expect(res.body.contact.emails).toEqual(
      expect.arrayContaining(["primary@fluxkart.com", "secondary@fluxkart.com"])
    );
    expect(res.body.contact.phoneNumbers).toEqual(["3000000000"]);
    expect(res.body.contact.secondaryContactIds.length).toBe(1);
  });

  it("should create a secondary contact if phoneNumber is new but email matches primary", async () => {
    const { data: primary } = await supabase
      .from("contacts")
      .insert({
        email: "primary2@fluxkart.com",
        phone_number: "4000000000",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    const res = await request(app).post("/identify").send({
      email: "primary2@fluxkart.com",
      phoneNumber: "4000000001",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.primaryContactId).toBe(primary?.id);
    expect(res.body.contact.emails).toEqual(["primary2@fluxkart.com"]);
    expect(res.body.contact.phoneNumbers).toEqual(
      expect.arrayContaining(["4000000000", "4000000001"])
    );
    expect(res.body.contact.secondaryContactIds.length).toBe(1);
  });

  it("should link multiple secondary contacts correctly", async () => {
    const { data: primary } = await supabase
      .from("contacts")
      .insert({
        email: "multi@fluxkart.com",
        phone_number: "5000000000",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    await supabase.from("contacts").insert([
      {
        email: "sec1@fluxkart.com",
        phone_number: "5000000000",
        linked_id: primary?.id,
        link_precedence: "secondary",
      },
      {
        email: "sec2@fluxkart.com",
        phone_number: "5000000000",
        linked_id: primary?.id,
        link_precedence: "secondary",
      },
    ]);

    const res = await request(app).post("/identify").send({
      email: "multi@fluxkart.com",
      phoneNumber: "5000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.primaryContactId).toBe(primary?.id);
    expect(res.body.contact.emails).toEqual(
      expect.arrayContaining([
        "multi@fluxkart.com",
        "sec1@fluxkart.com",
        "sec2@fluxkart.com",
      ])
    );
    expect(res.body.contact.phoneNumbers).toEqual(["5000000000"]);
    expect(res.body.contact.secondaryContactIds.length).toBe(2);
  });

  it("should create or return contact with only email provided", async () => {
    const res = await request(app).post("/identify").send({
      email: "onlyemail@fluxkart.com",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.emails).toContain("onlyemail@fluxkart.com");
    expect(res.body.contact.phoneNumbers).toEqual(expect.any(Array));
  });

  it("should create or return contact with only phoneNumber provided", async () => {
    const res = await request(app).post("/identify").send({
      phoneNumber: "6000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.phoneNumbers).toContain("6000000000");
    expect(res.body.contact.emails).toEqual(expect.any(Array));
  });

  it("should not create duplicate secondary contacts", async () => {
    const { data: primary } = await supabase
      .from("contacts")
      .insert({
        email: "nodup@fluxkart.com",
        phone_number: "7000000000",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    // First request creates secondary
    await request(app).post("/identify").send({
      email: "secondary@fluxkart.com",
      phoneNumber: "7000000000",
    });

    // Second request should not create a duplicate secondary
    const res = await request(app).post("/identify").send({
      email: "secondary@fluxkart.com",
      phoneNumber: "7000000000",
    });

    expect(res.status).toBe(200);

    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("linked_id", primary?.id)
      .eq("link_precedence", "secondary");

    expect(data?.length).toBe(1);
  });

  it("should update a primary contact to secondary when linked to another primary", async () => {
    // Insert two primary contacts
    const { data: primary1 } = await supabase
      .from("contacts")
      .insert({
        email: "primary1@fluxkart.com",
        phone_number: "8000000000",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    const { data: primary2 } = await supabase
      .from("contacts")
      .insert({
        email: "primary2@fluxkart.com",
        phone_number: "8000000001",
        link_precedence: "primary",
      })
      .select("*")
      .single();

    // Call identify with data linking the two primaries
    const res = await request(app).post("/identify").send({
      email: "primary2@fluxkart.com",
      phoneNumber: "8000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.contact.primaryContactId).toBe(primary1?.id);

    // Confirm primary2 now is secondary linked to primary1
    const { data: updatedPrimary2 } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", primary2?.id)
      .single();

    expect(updatedPrimary2?.link_precedence).toBe("secondary");
    expect(updatedPrimary2?.linked_id).toBe(primary1?.id);
  });
});
