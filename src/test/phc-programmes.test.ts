import { describe, expect, it } from "vitest";
import { classifyPhcProject } from "@/lib/public/phc-programmes";

describe("classifyPhcProject", () => {
  it.each([
    ["Conduction/Provision Of Routine Immunization Programme Across The State", "immunisation"],
    ["Solarization Of Board Headquarters, State Cold Store, Zonal Cold Store, LGA Cold", "immunisation"],
    ["Procurement Of 2 Operational Vehicles To Replace Aged Existing Ones For Efficient Vaccine Delivery", "immunisation"],
    ["Child Birth Spacing Programme In Primary Health Care", "family_planning"],
    ["Establishment Of Newborn Resuccitation Center In All The 44 LGAs In The State", "mnch"],
    ["Social And Behavior Change Communication Activities On Infant And Young Child Feeding (IYCF)", "nutrition"],
    ["Active Case Finding Of Severe Acute Malnutrition (SAM) And Provision Of Appropriate", "nutrition"],
    ["Supporting The Supervision And Last Mile Distribution Of Seasonal Malaria", "malaria"],
    ["Strengthening Tuber Cullosis Program Coordination, Monitoring And Supervision", "disease_control"],
    ["Furmingation Of Health Care Facilities Across The State", "disease_control"],
    ["Implementation Of Minimal Service Package (MSP) Investment Plan In The State", "essential_services"],
    ["Integration Of Non Communicable Diseases Into Primary Health Care Services At", "essential_services"],
    ["Coordination Of Communicable Diseases - Primary Health Care H/Q", "disease_control"],
    ["Conduction Of The ACSM Programme For The Focus Of Gender Improment Across", "community"],
    ["Scale-Up DRF With 100no. Additional Facilities To Increase Access Of Quality Drugs", "drugs_supplies"],
    ["Coordination Of LMCU Across All The 44 LGAs Of The State", "drugs_supplies"],
    ["Construction of Primary Healthcare in Kwajele town, Sumaila LocaL Government", "facilities"],
    ["Procurement Of 10no. Operational Vehicles ( 1no. Per Department To Support The", "facilities"],
    ["Strengthen The Health Management Information System, Health Data Generation", "health_systems"],
    ["Coordination Of Primary Health Care Services/Activities In The State", "health_systems"],
  ])("%s → %s", (name, key) => {
    expect(classifyPhcProject(name)).toBe(key);
  });
});
