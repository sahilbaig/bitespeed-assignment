import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const identifyService = async (email?: string, phoneNumber?: string) => {
  // Step 1: Find contacts matching email or phoneNumber
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
    // No contact found: create primary contact
    const { data: newContact, error: insertError } = await supabase
      .from("contacts")
      .insert([
        { email, phone_number: phoneNumber, link_precedence: "primary" },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      primaryContactId: newContact.id,
      emails: email ? [email] : [],
      phoneNumbers: phoneNumber ? [phoneNumber] : [],
      secondaryContactIds: [],
    };
  }

  // Step 2: Find primary contacts
  const primaryContacts = foundContacts.filter(
    (c) => c.link_precedence === "primary"
  );

  // Find oldest primary
  const primaryContact = primaryContacts.reduce(
    (oldest, c) =>
      new Date(c.created_at) < new Date(oldest.created_at) ? c : oldest,
    primaryContacts[0]
  );

  // Step 3: Get all linked contacts
  const { data: linkedContacts, error: linkedError } = await supabase
    .from("contacts")
    .select("*")
    .or(`id.eq.${primaryContact.id},linked_id.eq.${primaryContact.id}`);

  if (linkedError) throw linkedError;

  const emailsSet = new Set<string>();
  const phonesSet = new Set<string>();
  const secondaryIds: string[] = [];

  linkedContacts.forEach((contact) => {
    if (contact.email) emailsSet.add(contact.email);
    if (contact.phone_number) phonesSet.add(contact.phone_number);
    if (contact.link_precedence === "secondary") secondaryIds.push(contact.id);
  });

  // Step 4: Add secondary contact if new info
  const emailExists = email ? emailsSet.has(email) : false;
  const phoneExists = phoneNumber ? phonesSet.has(phoneNumber) : false;

  if ((!emailExists && email) || (!phoneExists && phoneNumber)) {
    const { data: newSecondary, error: secError } = await supabase
      .from("contacts")
      .insert([
        {
          email,
          phone_number: phoneNumber,
          linked_id: primaryContact.id,
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

  return {
    primaryContactId: primaryContact.id,
    emails: [
      primaryContact.email,
      ...Array.from(emailsSet).filter((e) => e !== primaryContact.email),
    ].filter(Boolean),
    phoneNumbers: [
      primaryContact.phone_number,
      ...Array.from(phonesSet).filter((p) => p !== primaryContact.phone_number),
    ].filter(Boolean),
    secondaryContactIds: secondaryIds,
  };
};
