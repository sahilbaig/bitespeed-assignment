import { Request, Response } from "express";
import { supabase } from "../utils/supabase/client";

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
    // Step 1: Find existing contacts
    const { data: foundContacts, error: fetchError } = await supabase
      .from("contacts")
      .select("*")
      .or(
        [
          email ? `email.eq.${email}` : "",
          phoneNumber ? `phone_number.eq.${phoneNumber}` : "",
        ]
          .filter(Boolean)
          .join(",")
      );

    if (fetchError) throw fetchError;

    if (!foundContacts || foundContacts.length === 0) {
      const { data: newContact, error: insertError } = await supabase
        .from("contacts")
        .insert([
          { email, phone_number: phoneNumber, link_precedence: "primary" },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      res.json({
        contact: {
          primaryContactId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [],
        },
      });
      return;
    }

    // Step 2: Get primary contact
    const primaryContacts = foundContacts.filter(
      (c) => c.link_precedence === "primary"
    );
    const primary = primaryContacts.reduce(
      (oldest, c) =>
        new Date(c.created_at) < new Date(oldest.created_at) ? c : oldest,
      primaryContacts[0]
    );

    // Step 3: Get all related contacts
    const { data: linkedContacts, error: linkedError } = await supabase
      .from("contacts")
      .select("*")
      .or(`id.eq.${primary.id},linked_id.eq.${primary.id}`);

    if (linkedError) throw linkedError;

    const emailsSet = new Set<string>();
    const phonesSet = new Set<string>();
    const secondaryIds: string[] = [];

    linkedContacts.forEach((contact) => {
      if (contact.email) emailsSet.add(contact.email);
      if (contact.phone_number) phonesSet.add(contact.phone_number);
      if (contact.link_precedence === "secondary")
        secondaryIds.push(contact.id);
    });

    const emailExists = email ? emailsSet.has(email) : false;
    const phoneExists = phoneNumber ? phonesSet.has(phoneNumber) : false;

    if ((!emailExists && email) || (!phoneExists && phoneNumber)) {
      const { data: newSecondary, error: secError } = await supabase
        .from("contacts")
        .insert([
          {
            email,
            phone_number: phoneNumber,
            linked_id: primary.id,
            link_precedence: "secondary",
          },
        ])
        .select()
        .single();

      if (secError) throw secError;

      if (newSecondary.email) emailsSet.add(newSecondary.email);
      if (newSecondary.phone_number) phonesSet.add(newSecondary.phone_number);
      secondaryIds.push(newSecondary.id);
    }

    res.json({
      contact: {
        primaryContactId: primary.id,
        emails: [
          primary.email,
          ...Array.from(emailsSet).filter((e) => e !== primary.email),
        ].filter(Boolean),
        phoneNumbers: [
          primary.phone_number,
          ...Array.from(phonesSet).filter((p) => p !== primary.phone_number),
        ].filter(Boolean),
        secondaryContactIds: secondaryIds,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
