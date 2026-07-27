# Seed Data Catalog

Source workbook: `/Users/kunle/Downloads/Kano Health Finance Tracker.xlsx`.

This catalog enumerates the data seeded into Supabase before routine user entry. AOP activities are intentionally excluded because they are documented and seeded separately.

## Summary

| Seed area | Target table | Count | Feeds dropdowns? |
| --- | --- | --- | --- |
| MDA types | `mda_types` | 8 | Yes, admin/reference filters |
| MDAs | `mdas` | 21 | Yes, entry forms, dashboards, imports, filters |
| Funding sources | `funding_sources` | 8 | Yes, funding form and filters |
| Expenditure categories | `expenditure_categories` | 11 | Yes, expenditure form and filters |
| Programme areas | `programme_areas` | 24 | Yes, funding/expenditure forms and filters |
| Payment methods | `payment_methods` | 6 | Yes, expenditure form and filters |
| LGAs | `lgas` | 44 | Yes, PHC expenditure form and filters |
| PHC facilities | `facilities` | 471 | Yes, dependent PHC facility dropdown |
| 2026 approved budgets | `approved_budgets` | 21 | No direct entry dropdown; feeds dashboards and budget filters |

## Dropdown Field Map

| Form/report field | Seeded table | Seeded values used |
| --- | --- | --- |
| MDA | `mdas` | 21 MDA names, each with code and MDA type |
| MDA Type | `mda_types` | 8 inferred MDA classifications |
| Funding Source | `funding_sources` | 8 workbook values |
| Expenditure Category | `expenditure_categories` | 11 workbook values |
| Programme Area | `programme_areas` | 24 workbook values |
| Payment Method | `payment_methods` | 6 workbook values |
| LGA | `lgas` | 44 Kano LGAs |
| Facility Name | `facilities` | 471 PHC facilities filtered by selected LGA |
| Expenditure Item | `expenditure_items` | No initial seed from workbook; admin-managed after launch |
| AOP Activity | `aop_activities` | Excluded from this catalog by request |

Ledger status seeds were removed by ADR 0005. Seeded active Funding and Expenditure Entries are reportable immediately; legacy rejected demo rows are intentionally omitted. BIR publication tables start empty so local resets do not lock seeded quarters.

## MDA Types

| Name |
| --- |
| Agency |
| Board |
| Centre |
| College |
| Fund |
| Hospital |
| Ministry |
| School |

## MDAs

| Code | Name | MDA Type |
| --- | --- | --- |
| 052100100100 | Ministry of Health (HQ) | Ministry |
| 052100300100 | Hospital Management Board (HMB) | Board |
| 052100300200 | Muhammadu Abdullahi Wase Specialist Hospital (MAWSH) | Hospital |
| 052100400100 | College of Nursing & Midwifery Board | Board |
| 052100400200 | School of Nursing Kano | School |
| 052100400300 | School of Basic Midwifery Kano | School |
| 052100400400 | School of Basic Midwifery Dambatta | School |
| 052100400600 | School of Nursing Madobi | School |
| 052100400700 | School of Post Basic Anesthesia | School |
| 052100400800 | School of Basic Midwifery Gwarzo | School |
| 052100500100 | Primary Health Care Management Board (PHCMB) | Board |
| 052100600100 | State Agency for Control of AIDS (SACA) | Agency |
| 052100800100 | Kano State Contributory Health Management Agency (KCHIMA) | Agency |
| 052100900100 | Kano State Health Trust Fund (KHETFUND) | Fund |
| 052101000100 | College of Health Science & Technology | College |
| 052101100100 | Private Health Institutions Management Agency (PHIMA) | Agency |
| 052101300100 | Drugs Management & Consumable Supply Agency (DMA) | Agency |
| 052101400100 | Kano State Centre for Disease Control & Prevention (KNCDC) | Centre |
| 052102000100 | School of Hygiene | School |
| 052103000100 | School of Health Technology Bebeji | School |
| 052104000100 | School of Health Technology Kano | School |

## Funding Sources

| Name |
| --- |
| Kano State Govt Budget Release |
| BHCPF Allocation |
| Donors / Development Partners Funding |
| LGA Contribution |
| NHIA / NHIS |
| Internally Generated Revenue (IGR) |
| Federal Government Grant |
| Other |

## Expenditure Categories

| Name |
| --- |
| Personnel Costs |
| Overhead / Running Costs |
| Capital Expenditure |
| Drugs & Medical Supplies |
| Training & Capacity Building |
| Outreach & Service Delivery |
| Monitoring & Evaluation |
| Community Engagement |
| Infrastructure & Rehabilitation |
| Equipment & Furniture |
| Transport & Logistics |

## Programme Areas

| Name |
| --- |
| Admin & General Services |
| Planning, Research & Statistics |
| Nursing Services |
| Pharmaceutical Services |
| Medical Services |
| Public Health & Disease Control |
| Physical Planning |
| Hospital Services |
| Family Health |
| Disease Control |
| Environmental & Public Health |
| Information & Communication Technology |
| Health Management / Programmes |
| Health Emergency, Preparedness & Response |
| Drug & Supply Management |
| Community Health Services |
| Health Financing |
| Human Resource for Health |
| Reproductive, Maternal, Newborn & Child Health |
| Immunisation & Vaccines |
| HIV/AIDS, TB & Malaria |
| Mental Health |
| Non-Communicable Diseases |
| Other |

## Payment Methods

| Name |
| --- |
| Bank Transfer |
| Cheque |
| Cash |
| GIFMIS |
| IPPIS |
| Other |

## LGAs

| Name |
| --- |
| Ajingi |
| Albasu |
| Bagwai |
| Bebeji |
| Bichi |
| Bunkure |
| Dala |
| Danbatta |
| Dawakin Kudu |
| Dawakin Tofa |
| Doguwa |
| Fagge |
| Gabasawa |
| Garko |
| Garum Mallam |
| Gaya |
| Gezawa |
| Gwale |
| Gwarzo |
| Kabo |
| Kano Municipal |
| Karaye |
| Kibiya |
| Kiru |
| Kumbotso |
| Kunchi |
| Kura |
| Madobi |
| Makoda |
| Minjibir |
| Nasarawa |
| Rano |
| Rimin Gado |
| Rogo |
| Shanono |
| Sumaila |
| Takai |
| Tarauni |
| Tofa |
| Tsanyawa |
| Tudun Wada |
| Ungogo |
| Warawa |
| Wudil |

## PHC Facilities

All seeded facilities use `facility_type = phc`. The facility dropdown should be filtered by the selected LGA.

### Ajingi

| Facility Name |
| --- |
| Sakalawa Health Post |
| Balare Primary Health Centre |
| Chula Health Clinic |
| Fagawa Health Post |
| Gafasa Health Clinic |
| Dundun Health Post |
| Gurduba Primary Health Care |
| Makarya Primary Health Center |
| Toranke Primary Health Centre |
| Unguwar Bai Health Post |

### Albasu

| Facility Name |
| --- |
| Duja Health Post |
| Faragai Health Post |
| Gagarami Health Post |
| Hungu Primary Health Centre |
| Panda Primary Health Center |
| Saya Saya Primary Health Center (ALB) |
| Tsangaya Primary Health Centre |
| Daho Health Post |
| Bataiya Primary Health Centre |

### Bagwai

| Facility Name |
| --- |
| Abbas Primary Health Centre |
| Dangada Primary Health Centre |
| Gadanya Primary Health Centre |
| Gogori Primary Health Centre |
| Kiyawa Primary Health Centre |
| Kwajale Primary Health Centre |
| Romo Primary Health Centre |
| Sare-Sare Primary Health Centre |
| Wuro-Bagga Primary Health Centre |
| Rimin Dako Health Post |

### Bebeji

| Facility Name |
| --- |
| Anadariya Health Post |
| Kuki Health Post |
| Jibga Health Post (Bebeji) |
| Baguda Health Post |
| Damau Health Post |
| Durmawa Health Post |
| Gargai Health Post |
| Gwarmai Primary Health Centre (Bebeji) |
| Kofa Primary Health Centre |
| Rahama (B) Health Post |
| Ranka Health Post |
| Wak Primary Health Center |
| Tariwa Primary Health Center |
| Rantan Health Post |

### Bichi

| Facility Name |
| --- |
| Danzabuwa Primary Health Centre |
| Fagwalo Health Post |
| Dutsen Karya Health Post |
| Kwamarawa Health Post |
| Chiromawa Primary Health Centre |
| Muntsira Health Post |
| Saye Primary Health Centre |
| Waire Health Post |
| Damargu Primary Health Centre |
| Badume Primary Health Centre |

### Bunkure

| Facility Name |
| --- |
| Bunkure Basic Health Clinic |
| Chirin Health Post |
| Gafan Health Clinic |
| Gurjiya Primary Health Care |
| Gwamma Health Post |
| Kulluwa Health Post |
| Sanda Health Post |
| Bono Primary Health Centre |
| Barkum Health Clinic |

### Dala

| Facility Name |
| --- |
| Adakawa Primary Health Centre |
| Bakin Ruwa Basic Health Centre |
| Mai Unguwa Garba Dala Health Clinic |
| Goron Dutse Primary Health Centre (Dal) |
| Kurna Primary Health Centre |
| Gwammaja Maternity And Child Health Clinic |
| Dala Primary Health Care Centre |
| Kantudu Health Clinic |
| Kofar Mazugal Primary Health Clinic |
| Dandinshe Primary Health Centre |
| Madigawa Health Post |
| Yalwa Primary Health Centre (DAL) |

### Danbatta

| Facility Name |
| --- |
| Ajumawa Health Post |
| Women Centre Health Post |
| Fagwalo Health Post |
| Tona Health Post |
| Goron Maje Primary Health Centre |
| Gwanda Primary Health Centre (Dambatta) |
| Gwarabjawa Health Post |
| Kore Primary Health Center |
| Sansan Primary Health Centre |

### Dawakin Kudu

| Facility Name |
| --- |
| Daba Primary Health Centre |
| Runa Health Post |
| Dawaki Primary Health Center |
| Dawakiji Primary Health Center |
| Kamgata Health Post |
| Gano Primary Health Center |
| Gurjiya Health Clinic |
| Jido Health Clinic |
| Gada Health Post |
| Tsakuwa Primary Health Centre |
| Unguwar Duniya Health Post |
| Sarai Health Post |
| Yankatsari Health Post |
| Yargaya Health Post |
| Zogarawa Health Post |

### Dawakin Tofa

| Facility Name |
| --- |
| Danguguwa Primary Health Centre |
| Sarkakiya Health Post |
| Dawanau Primary Health Centre |
| Ganduje Primary Health Centre |
| Gargari Health Post |
| Jalli Health Primary Health Centre |
| Kwa Health Clinic |
| Marke Health Clinic |
| Tattarawa Primary Health Centre |
| Dandalama Primary Health Center |

### Doguwa

| Facility Name |
| --- |
| Dariyar Shere Health Post |
| Burji Primary Health Centre |
| Bamako Initiative Health Post |
| Falgore Primary Health Centre |
| Maraku Primary Health Clinic |
| Dadin-Kowa Primary Health Centre |
| Riruwai Primary Health Centre |
| Tagwaye Primary Health Centre |
| Unguwar Natsohuwa Health Clinic |
| Zainabi Health Post |

### Fagge

| Facility Name |
| --- |
| Sabo Garba Maternal and Child Health Clinic |
| Galadima Fagge Primary Health Centre |
| Wapa Primary Health Centre |
| Fatima Ganduje Primary Health Care |
| Kwacire Primary Health Centre |
| Rijiyar Lemo Model Primary Health Centre |
| Jaba Model Primary Health Centre |
| Middle Road Maternity and Child Health |
| Sheik Musa Kallah Primary Health Care |

### Gabasawa

| Facility Name |
| --- |
| Gabasawa Primary Health Centre |
| Garun Danga Primary Health Centre |
| Santsi Health Post |
| Karmami Maternal And Child Health Clinic |
| Mekiya Health Post |
| Tarauni Health Post |
| YanDake Health Post |
| YautarKudu Primary Health Centre |
| Yama Kanawa Health Post |
| Zakirai Primary Health Centre |
| Zugachi Primary Health Centre |

### Garko

| Facility Name |
| --- |
| Dal Primary Health Centre |
| Garin-Ali Primary Health Centre |
| Garko Primary Health Centre |
| Gurjiya Health Post (GAK) |
| Kafin Malami Health Post |
| Sanni Health Post |
| Buda Health Post |
| Garwaji Health Post |
| Sarina Primary Health Centre |
| Kafinchiri Primary Health Centre |

### Garum Mallam

| Facility Name |
| --- |
| Chiromawa Health Clinic |
| Dakasoye Health Post |
| Dorawar Sallau Health Post |
| Yanaba Health Post |
| Garun Babba Primary Health Centre |
| Garun Mallam Primary Health Centre |
| Jobawa Health Post |
| Kadawa Gate Primary Health Centre |
| Makwaro Health Post |
| Yadakwari Primary Health Centre |

### Gaya

| Facility Name |
| --- |
| Balan Primary Health Centre |
| Gamarya Primary Health Clinic |
| Gamoji Health Post |
| Rabiu Musa Kwankwaso Primary Health Center |
| Nafisatu Mahammud Primary Health Center |
| Kademi Primary Health Centre |
| Yankau Primary Health Clinic |
| Gidan Sarkin Noma Primary Health Centre |
| Yan Audu Primary Health Centre |
| Gungara Health Post |

### Gezawa

| Facility Name |
| --- |
| Babawa Primary Health Centre |
| Gofaro Primary Health Centre |
| Gezawa Health Clinic |
| Jogana Health Clinic |
| Tsamiyar Kara Primary Health Centre |
| Mesar Burmi Health Post |
| Sararin Gezawa Health Clinic |
| Larabar Abasawa Primary Health Clinic |
| Tumbau Health Post |
| Wangara Primary Health Centre |
| Tsalle Primary Health Care Centre |

### Gwale

| Facility Name |
| --- |
| Diso Health Post |
| Ja'En Primary Health Centre |
| Fuskar Yamma Health Clinic |
| Gwaron Dutse Health Clinic |
| Mangorori Health Post |
| Kabuga Primary Health Centre |
| Sabon Sara Health Clinic |
| Kwamatin Makota Health Clinic |

### Gwarzo

| Facility Name |
| --- |
| Getso Cottage Hospital |
| Yar Kasuwa Health Clinic |
| Jama'a Primary Health Centre |
| Sabon Layin Kara Primary Health Center |
| Kutama Primary Health Centre |
| Lakwaya Primary Health Centre |
| Madadi Primary Health Center |
| Mainika Health Post |
| Sabon Birni Primary Health Centre |
| Kwami Primary Health Centre |

### Kabo

| Facility Name |
| --- |
| Dugabau Health Clinic |
| DurunMCH |
| Gammo Primary Health Centre |
| Garo Primary Health Centre |
| Godiya Primary Health Centre |
| Gude Health Post |
| Hauwaden Bango Primary Health Centre |
| Mallam Gajere Health Post |
| Kanwa Health Post |
| Masanawa Health Clinic |

### Kano Municipal

| Facility Name |
| --- |
| Chedi Health Clinic |
| Dan Agundi Health Post |
| Gandu Primary Health Centre |
| Unguwar Gini Primary Health Centre |
| Fuskar Gabas Primary Health Centre |
| Sharada Primary Health Centre |
| Datti Wudilawa Clinic |
| Emir's Palace Primary Health Centre |
| Zubairiyya Health Post |
| Yan Awaki Primary Health Centre |

### Karaye

| Facility Name |
| --- |
| Daura Health Post |
| Husama Health Post |
| Kurugu Health Post |
| Kwanyawa Primary Health Centre |
| Tinkis Health Post |
| Karaye Primary Health Centre |
| Tudun Kaya Health Post |
| Turawa Primary Health Centre |
| Yammedi Primary Health Centre |
| Yola Primary Health Centre |

### Kibiya

| Facility Name |
| --- |
| Durba Primary Health Center |
| Kure Primary Health Centre |
| Saya Saya Primary Health Center |
| Kadigawa Health Post |
| Kahu Health Post |
| Kibiya Primary Health Centre |
| Gunda Health Post |
| Nariya Health Post |
| Tarai Primary Health Center |
| Unguwar Gai Health Post |

### Kiru

| Facility Name |
| --- |
| Ba'awa Primary Health Centre |
| Badafi Health Post |
| Bargoni Health Post |
| Bauda Health Clinic |
| Dangora Primary Health Centre |
| Dansoshiya Health Post |
| Dashi Health Post |
| Galadimawa Health Post (KKU) |
| Kiru Primary Health Centre |
| Kogo Primary Health Centre |
| Maraku Health Post |
| Tsaudawa Health Post |
| YakoBasic Health Clinic |
| Kafin Maiyaki Primary Health Centre |
| Zuwo Health Clinic |

### Kumbotso

| Facility Name |
| --- |
| Chalawa Primary Health Centre |
| Chiranchi Primary Health Centre |
| Dan Maliki Health Clinic |
| Danbare Health Post |
| Guringawa Primary Health Centre |
| Ruga Fada Health Post |
| AhmedAdoBayero Primary Health Centre |
| Mariri Primary Health Centre |
| Naibawa Health Clinic |
| Panshekara Primary Health Centre |
| Unguwar Rimi Health Post |

### Kunchi

| Facility Name |
| --- |
| Unguwar Gyartai Health Post |
| Gidan Nisau Heath Post |
| Gwarmai Primary Health Centre (c) |
| Kasuwar Kuka Primary Health Centre |
| Kunchi Primary Health Centre |
| Matan Fada Health Post |
| Ridawa Health Post |
| Gwadama Primary Health Centre |
| Shuwaki Primary Health Centre |
| Yan Dadi Primary Health Centre |

### Kura

| Facility Name |
| --- |
| Hadeja Jama'are Health Post |
| Dan-Hassan Primary Health Centre |
| Dukawa Primary Health Center |
| Gundutse Health Post |
| Karfi Primary Health Center |
| Sani Marshal Memorial Maternity Primary Health Center |
| Kirya Health Post |
| Alkalawa Health Post |
| TanawaA Health Post |
| TanawaB Health Post |
| Imawa Health Post |

### Madobi

| Facility Name |
| --- |
| Burji Primary Health Centre |
| Chinkoso Health Clinic |
| Galinja Health Clinic |
| Gora Primary Health Clinic |
| Kafin Agur Primary Health Centre |
| Kanwa Primary Health Clinic |
| Kauran Mata Primary Health Centre |
| Kubarachi Health Clinic |
| Daburau Health Post |
| Akilu Memorial Primary Health Centre |
| Rikadawa Health Clinic |
| Yakun Health Clinic |

### Makoda

| Facility Name |
| --- |
| Dr. Wada Waziri Primary Health Centre |
| Tasharbasa Health Post |
| Jibga Health Post |
| Kantudu Primary Health Centre |
| Koguna Primary Health Centre |
| Mai-Tsidau Primary Health Centre |
| Makoda Primary Health Centre |
| DawanKaya Health Post |
| Tangajiyo Health Post |
| Wailare Health Post |
| KorenTabo Health Post |

### Minjibir

| Facility Name |
| --- |
| Sanbauna Primary Health Centre |
| Gadurwawa Primary Health Centre |
| Geranya Health Clinic |
| Kunya Primary Health Centre |
| Kuru Health Clinic |
| Gasgainu Health Clinic |
| Minjibir Health Clinic |
| Sarbi Health Post |
| Tsakiya Health Clinic |
| Kankarawa Health Clinic |
| Wasai Health Post |

### Nasarawa

| Facility Name |
| --- |
| Dawakin Dakata Primary Health Centre |
| Gama Health Clinic |
| Gwagwarwa Primary Health Centre |
| Giginyu Primary Health Centre |
| Hotoro Arewa Primary Health Centre |
| Hotoro South Health Clinic |
| Kaura Goje Primary Health Centre |
| Kawaji Health Clinic |
| Tudun Murtala Health Centre |
| Kano School of Health Technology Clinic |

### Rano

| Facility Name |
| --- |
| Lausu Health Post |
| Madachi Health Post |
| Kurmi Health Post |
| Rano Dawaki Health Clinic |
| Munture Health Clinic |
| Rurum Primary Health Clinic |
| Rurum Sabon Gari Primary Health Clinic |
| Saji Health Clinic |
| Yalwa Health Post (Ran) |
| Taitai Primary Health Clinic |
| Tabobi Health Post |

### Rimin Gado

| Facility Name |
| --- |
| Butu Butu Primary Health Centre |
| Dawakin Gulu Health Post |
| Doka-Dawa Health Post |
| Dugurawa Health Post |
| Gulu Primary Health Centre |
| Jili Health Post |
| Karofin Yashi Health Post |
| Rimin Gado Primary Health Centre |
| Sakaratsa Health Post |
| Tamawa Health Post |
| Yalwa-Danziyal Primary Health Centre |
| Zango1 Health Post |

### Rogo

| Facility Name |
| --- |
| Beli Primary Health  Center |
| Falgore Primary Health Centre |
| Fulatan Health Clinic |
| Bari Primary Health Centre |
| Jajaye Health Clinic |
| Rogo Tsohuwa Health Post |
| Kauyen Liman Health Post |
| Ruwan Bago Health Post |
| Zarewa Health Clinic |
| Kaleku Health Clinic |

### Shanono

| Facility Name |
| --- |
| Alajawa Health Post |
| Dutsen Bakoshi Health Post |
| Faruruwa Primary Health Centre |
| Goron Dutse Health Post  (Snn) |
| Kadamu Primary Health Centre |
| Kokiya Health Post |
| Leni Primary Health Centre |
| Shakogi Health Post |
| Shanono Primary Health Centre |
| Tsaure Primary Health Centre |

### Sumaila

| Facility Name |
| --- |
| Gala Primary Health  Center |
| Gani Primary Health Centre |
| Garfa Health Post |
| Gediya Primary Health Centre |
| Kanawa Primary Health  Center |
| Magami Primary Health Centre |
| Massu Primary Health Centre |
| Rimi Primary Health Centre |
| Rumo Health Clinic |
| Sitti Primary Health Centre |
| Sumaila Yamma Primary Health Centre |

### Takai

| Facility Name |
| --- |
| Birnin Bako Health Post |
| Durbinde Primary Health Centre |
| Fajewa Model Primary Health Centre |
| Falali Health Post |
| Dambazau Primary HealthC entre  (TAK) |
| Kachako Primary Health Centre |
| Karfi Primary Health Centre |
| Kafinsidda Health Post |
| Takai Nysc Primary Health Centre |
| Zuga Health Post |

### Tarauni

| Facility Name |
| --- |
| Hausawa Primary Health Centre |
| Dan Tsinke Primary Health Centre |
| Daurawa Primary Health Clinic |
| Ja'Oji Primary Health Centre |
| Gyadi-GyadiKudu Primary Health Clinic |
| Hotoro Danmarke Primary Health Clinic |
| Tarauni Primary Health Centre |
| Unguwa Uku Primary Health Centre |
| Kauyen Alu Primary Health Centre |
| YarAkwa Primary Health Clinic |

### Tofa

| Facility Name |
| --- |
| Dindere Health Post |
| Doka Primary Health  Center |
| Gadija Health Post |
| Ginsawa Health Post |
| Janguza Health Post |
| Bugai Primary Health Clinic |
| Kwami Health Post |
| Lambu Primary Health  Center |
| Langel Health Post |
| Tofa Primary Health Centre |
| Unguwar Rimi Health Clinic |
| Tabanni Health Post |
| Yalwa Karama Health Post |
| Yanoko Health Post |
| Yarimawa Health Post |

### Tsanyawa

| Facility Name |
| --- |
| Daddarawa Primary Health Centre |
| Dumbulum Health Centre |
| Tafashiya Primary Health Centre |
| Gurun Primary Health Care Centre |
| Harbau Primary Health Centre |
| Yargwanda Primary Health Centre |
| Tsanyawamodal Primary Health  Center |
| Yan-kamaye Primary Health  Center |
| Yanganau Health Post |
| Zarogi Health Post |

### Tudun Wada

| Facility Name |
| --- |
| Yaryasa Primary Health Centre |
| Jan Dutse Health Post |
| NaTa'Ala Primary Health Centre |
| Dalawa Health Post |
| Baburi Primary Health Clinic |
| Karefa Health Post |
| Kurkujawa Primary Health Clinic |
| RuguRugu Primary Health Centre |
| Jan Maje Health Post |

### Ungogo

| Facility Name |
| --- |
| Dantamashe Primary Health Centre |
| Gayawa Basic Health Centre |
| Panisau Health Clinic |
| Bachirawa Health Post |
| Inusawa Health Post |
| Kadawa Health Clinic |
| Bagujan Health Post |
| Zaura Babba Health Post |
| Rijiyar Zaki Primary Health Centre |
| Ungogo Primary Health Centre |
| Tudun Fulani Primary Health Center |

### Warawa

| Facility Name |
| --- |
| Alitini Health Post |
| Warawa Primary Health Centre |
| YanDalla Health Post |
| Tanagar Health Post |
| Danlasan Primary Health Clinic |
| Katarkawa Health Post |
| JumarGaladima Health Post |
| Ganakakun Health Post |
| Jemagu Health Post |
| Amarawa Health Post (Wra) |
| Tamburawar Gabas Primary Health Center |
| Jigawa Health Post (WRA) |
| Garin Dau Health Post |
| Imawa Health Post (WRA) |
| Gogel Primary Health Centre |

### Wudil

| Facility Name |
| --- |
| Utai Primary Health Centre |
| Wudil Health Post |
| Makanwachi Health Post |
| Lajawa Primary Health Centre |
| Kausani Health Clinic |
| Indabo Primary Health Centre |
| Achika Health Post |
| Darki Primary Health Centre |
| Dagumawa Health Post |

## 2026 Approved Budgets

These rows feed budget-versus-actual dashboards and filters. The workbook sector-total row is not imported as an MDA budget row.

| MDA Code | MDA | Personnel | Other Recurrent | Total Recurrent | Capital | Total Budget |
| --- | --- | --- | --- | --- | --- | --- |
| 052100100100 | Ministry of Health (HQ) | 5,213,024,000.00 | 5,983,519,445.00 | 11,196,543,445.00 | 91,360,467,517.09 | 102,557,010,962.09 |
| 052100300100 | Hospital Management Board (HMB) | 58,750,191,000.00 | 5,295,314,349.37 | 64,045,505,349.37 | 4,040,000,000.00 | 68,085,505,349.37 |
| 052100300200 | Muhammadu Abdullahi Wase Specialist Hospital (MAWSH) | 0.00 | 981,334,000.00 | 981,334,000.00 | 1,673,806,488.95 | 2,655,140,488.95 |
| 052100400100 | College of Nursing & Midwifery Board | 0.00 | 246,350,000.00 | 246,350,000.00 | 0.00 | 246,350,000.00 |
| 052100400200 | School of Nursing Kano | 0.00 | 34,800,000.00 | 34,800,000.00 | 0.00 | 34,800,000.00 |
| 052100400300 | School of Basic Midwifery Kano | 0.00 | 32,000,000.00 | 32,000,000.00 | 0.00 | 32,000,000.00 |
| 052100400400 | School of Basic Midwifery Dambatta | 0.00 | 30,800,000.00 | 30,800,000.00 | 0.00 | 30,800,000.00 |
| 052100400600 | School of Nursing Madobi | 0.00 | 31,050,000.00 | 31,050,000.00 | 0.00 | 31,050,000.00 |
| 052100400700 | School of Post Basic Anesthesia | 0.00 | 16,600,000.00 | 16,600,000.00 | 0.00 | 16,600,000.00 |
| 052100400800 | School of Basic Midwifery Gwarzo | 0.00 | 26,900,000.00 | 26,900,000.00 | 0.00 | 26,900,000.00 |
| 052100500100 | Primary Health Care Management Board (PHCMB) | 700,512,000.00 | 2,016,612,000.00 | 2,717,124,000.00 | 12,901,240,748.29 | 15,618,364,748.29 |
| 052100600100 | State Agency for Control of AIDS (SACA) | 0.00 | 12,000,000.00 | 12,000,000.00 | 1,288,881,920.00 | 1,300,881,920.00 |
| 052100800100 | Kano State Contributory Health Management Agency (KCHIMA) | 0.00 | 1,397,000,000.00 | 1,397,000,000.00 | 7,364,500,000.00 | 8,761,500,000.00 |
| 052100900100 | Kano State Health Trust Fund (KHETFUND) | 0.00 | 191,000,000.00 | 191,000,000.00 | 7,200,594,170.00 | 7,391,594,170.00 |
| 052101000100 | College of Health Science & Technology | 0.00 | 17,369,000.00 | 17,369,000.00 | 0.00 | 17,369,000.00 |
| 052101100100 | Private Health Institutions Management Agency (PHIMA) | 0.00 | 270,500,000.00 | 270,500,000.00 | 404,000,000.00 | 674,500,000.00 |
| 052101300100 | Drugs Management & Consumable Supply Agency (DMA) | 0.00 | 277,500,000.00 | 277,500,000.00 | 2,780,227,896.00 | 3,057,727,896.00 |
| 052101400100 | Kano State Centre for Disease Control & Prevention (KNCDC) | 0.00 | 1,328,485,588.00 | 1,328,485,588.00 | 1,766,123,270.00 | 3,094,608,858.00 |
| 052102000100 | School of Hygiene | 0.00 | 6,250,000.00 | 6,250,000.00 | 0.00 | 6,250,000.00 |
| 052103000100 | School of Health Technology Bebeji | 0.00 | 42,500,000.00 | 42,500,000.00 | 0.00 | 42,500,000.00 |
| 052104000100 | School of Health Technology Kano | 0.00 | 88,500,000.00 | 88,500,000.00 | 1,069,355,871.00 | 1,157,855,871.00 |

## Not Seeded Initially

| Data area | Reason |
| --- | --- |
| Expenditure items | The workbook labels the field but does not provide an item list. Admins will manage this dropdown in the platform. |
| Users and MDA memberships | These depend on real Supabase Auth users and should be configured during onboarding. |
| Submission windows | The default v1 posture is permissive until admins create windows. |
| Unspecified PHC Facility fallback rows | The platform supports them, but they are not auto-seeded; admins can create them per LGA if needed. |
| Entry attachments | Created only when users upload supporting documents. |
| Reference value requests | Created by MDA users when a dropdown value is missing. |
| Funding and expenditure entries | Routine reporting data should be entered through authenticated forms or historical admin imports. |
