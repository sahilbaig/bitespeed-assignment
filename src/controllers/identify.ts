import { Request, Response } from "express";
import { supabase } from "../utils/supabase/client";

export const identifyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    res.status(400).json({ error: "email or phone number required" });
    return;
  }

  try {
    // Step 1: Find matching contacts
    const { data: foundContacts } = await supabase
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

    // Step 2: If none found, insert as primary
    if (!foundContacts || foundContacts.length === 0) {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert([
          { email, phone_number: phoneNumber, link_precedence: "primary" },
        ])
        .select()
        .single();

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

    // Step 3: Find all related contacts
    const { data: allContacts } = await supabase.from("contacts").select("*");

    const getAllRelated = (startContacts: any[]) => {
      const visited = new Set<number>();
      const queue = startContacts.map((c) => c.id);

      while (queue.length) {
        const id = queue.shift()!;
        visited.add(id);
        for (const c of allContacts || []) {
          if (
            (c.id === id || c.linked_id === id || c.linked_id === id) &&
            !visited.has(c.id)
          ) {
            queue.push(c.id);
          }
        }
      }

      return (allContacts || []).filter(
        (c) => visited.has(c.id) || visited.has(c.linked_id)
      );
    };

    const linkedContacts = getAllRelated(foundContacts);

    // Step 4: Determine primary and demote others
    const primaryContacts = linkedContacts.filter(
      (c) => c.link_precedence === "primary"
    );
    const rootPrimary = primaryContacts.reduce(
      (oldest, c) =>
        new Date(c.created_at) < new Date(oldest.created_at) ? c : oldest,
      primaryContacts[0]
    );

    const toDemote = primaryContacts.filter((c) => c.id !== rootPrimary.id);
    for (const c of toDemote) {
      await supabase
        .from("contacts")
        .update({ link_precedence: "secondary", linked_id: rootPrimary.id })
        .eq("id", c.id);
    }

    // Step 5: Dedup and maybe insert new secondary
    const emailsSet = new Set<string>();
    const phonesSet = new Set<string>();
    const secondaryIds: number[] = [];

    linkedContacts.forEach((c) => {
      if (c.email) emailsSet.add(c.email);
      if (c.phone_number) phonesSet.add(c.phone_number);
      if (c.link_precedence === "secondary") secondaryIds.push(c.id);
    });

    const duplicateExists = linkedContacts.some((c) => {
      const emailMatch = email ? c.email === email : false;
      const phoneMatch = phoneNumber ? c.phone_number === phoneNumber : false;

      if (email && phoneNumber) return emailMatch && phoneMatch;
      return emailMatch || phoneMatch;
    });

    if (!duplicateExists && (email || phoneNumber)) {
      const { data: newSecondary } = await supabase
        .from("contacts")
        .insert([
          {
            email,
            phone_number: phoneNumber,
            linked_id: rootPrimary.id,
            link_precedence: "secondary",
          },
        ])
        .select()
        .single();

      if (newSecondary.email) emailsSet.add(newSecondary.email);
      if (newSecondary.phone_number) phonesSet.add(newSecondary.phone_number);
      secondaryIds.push(newSecondary.id);
    }

    // Step 6: Respond
    res.json({
      contact: {
        primaryContactId: rootPrimary.id,
        emails: [
          rootPrimary.email,
          ...Array.from(emailsSet).filter((e) => e !== rootPrimary.email),
        ].filter(Boolean),
        phoneNumbers: [
          rootPrimary.phone_number,
          ...Array.from(phonesSet).filter(
            (p) => p !== rootPrimary.phone_number
          ),
        ].filter(Boolean),
        secondaryContactIds: secondaryIds,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
