// Generated public client metadata; no private definitions or boundary geometry.
export const publicAreaEntries=[
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.5635,
      43.5739
    ],
    "boundaryLabel": "Official city limits",
    "boundarySources": [
      "https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer/6",
      "https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer/12"
    ],
    "addressSearch": {
      "addressField": "SiteAddres",
      "where": "UPPER(SiteCity) = 'NAMPA' AND SiteState = 'ID'",
      "suffix": "Nampa, ID"
    },
    "flumCompatibility": {
      "zoningCodePattern": "\\b(?:RS\\s*\\d+(?:\\.\\d+)?|RML|RMH|RD|RA|RP|BN|BC|GB[12]?|IP|IL|IH|HC|U)\\b",
      "categories": {
        "Medium Density Residential": {
          "districts": [
            "RS4",
            "RS6",
            "RS7",
            "RS8.5"
          ],
          "sourceUrl": "https://www.cityofnampa.us/DocumentCenter/View/13801/3-Medium-Density-Residential"
        },
        "Industrial": {
          "districts": [
            "IL",
            "IP",
            "IH"
          ],
          "sourceUrl": "https://www.cityofnampa.us/DocumentCenter/View/13805/7-Industrial"
        }
      }
    },
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "P&Z",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "City Council",
        "label": "City Council",
        "shortLabel": "Council",
        "stageLabel": "Council hearing"
      }
    },
    "meetingRules": {
      "defaultHearingTime": "18:00",
      "decisionCommentDeadlineHour": 12,
      "agendaNotice": "Agenda usually posted the Thursday before the meeting",
      "location": "Nampa City Hall, Council Chambers, 411 3rd St S, Nampa, ID",
      "commentInstructions": "Once the agenda is posted, use the comment bubble in the meeting portal to send written comments, or the microphone button to sign up to speak. Include the relevant case number."
    },
    "commentInstructionsUrl": "https://www.cityofnampa.us/1616/Public-Comment",
    "sources": {
      "cases": "https://utility.arcgis.com/usrsvcs/servers/757f490738bd43da906508745cf92337/rest/services/Public/PZ_Hearings/MapServer",
      "hearingsSchedule": "https://www.cityofnampa.us/1433/Upcoming-Public-Hearings",
      "geometry": [
        "https://utility.arcgis.com/usrsvcs/servers/757f490738bd43da906508745cf92337/rest/services/Public/PZ_Hearings/MapServer/0",
        "https://utility.arcgis.com/usrsvcs/servers/757f490738bd43da906508745cf92337/rest/services/Public/PZ_Hearings/MapServer/1"
      ],
      "flum": "https://utility.arcgis.com/usrsvcs/servers/3543690ae3bf41a1a77b9b9b2bc477ca/rest/services/Public/NampaOpenData/MapServer/30",
      "agendas": "https://nampa.primegov.com/public/portal",
      "addressPoints": "https://utility.arcgis.com/usrsvcs/servers/2cb0c34984644eb19ebeb3f8a17b7dc9/rest/services/Public/CityInformation_Public/MapServer/35",
      "parcelFallback": "https://maps.canyonco.org/arcgisserver/rest/services/Assessor/CCPublicTaxparcels/MapServer/0"
    },
    "id": "nampa",
    "slug": "nampa",
    "name": "Nampa",
    "type": "city",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#2563eb"
  },
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.3915,
      43.6121
    ],
    "boundaryLabel": "Official city limits",
    "boundarySources": [
      "https://gis.meridiancity.org/server/rest/services/CD/Boundaries_places_Webservice/MapServer/2"
    ],
    "coverageNote": "City planning applications. Nearby unincorporated areas may have a different planning authority.",
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "P&Z",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "City Council",
        "label": "City Council",
        "shortLabel": "Council",
        "stageLabel": "Council hearing"
      }
    },
    "meetingRules": {
      "agendaNotice": "Check the official agenda archive for the meeting agenda and packet.",
      "location": "City Council Chambers, 33 East Broadway Avenue, Meridian, Idaho",
      "commentInstructions": "Follow the City's public-meeting instructions to submit written testimony or sign up to speak. Confirm the deadline for your hearing; the noon exhibit deadline is separate from written testimony."
    },
    "commentInstructionsUrl": "https://meridiancity.org/government/public-meeting-information/",
    "sources": {
      "cases": "https://gis.meridiancity.org/server/rest/services/CD/Development_Feature_Layer/FeatureServer/6",
      "geometry": [
        "https://gis.meridiancity.org/server/rest/services/CD/Development_Feature_Layer/FeatureServer/6"
      ],
      "flum": "https://gis.meridiancity.org/server/rest/services/CD/FLUM_Webservice/MapServer/15",
      "hearingsSchedule": "https://apps.meridiancity.org/CLERKSCONTENT/pubhearnot_detail.aspx",
      "agendas": "https://apps.meridiancity.org/CLERKSCONTENT/meridian_agenda_minutes.aspx",
      "parcelFallback": "https://gis.meridiancity.org/server/rest/services/CD/Parcel_Layers/MapServer/0"
    },
    "id": "meridian",
    "slug": "meridian",
    "name": "Meridian",
    "type": "city",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#d97706"
  },
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.7,
      43.63
    ],
    "boundaryLabel": "Unincorporated Canyon County",
    "coverageNote": "County land-use cases. Incorporated cities have separate planning authorities; a postal city does not determine jurisdiction.",
    "boundarySources": [
      "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1",
      "https://maps.canyonco.org/arcgisserver/rest/services/General/CITY_LIMITS_PUBLIC/FeatureServer/0"
    ],
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "Planning / Examiner",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "Board of County Commissioners",
        "label": "Board of County Commissioners",
        "shortLabel": "Board",
        "stageLabel": "Board hearing"
      },
      "additional": [
        {
          "id": "Hearing Examiner",
          "label": "Hearing Examiner",
          "shortLabel": "Examiner",
          "stageLabel": "Hearing Examiner"
        }
      ]
    },
    "meetingRules": {
      "agendaNotice": "Staff reports are published seven days before the scheduled hearing.",
      "commentInstructions": "Use the case-specific comment deadline and contact shown in the County's hearing record. Confirm how to submit comments and the hearing location in the published notice."
    },
    "commentInstructionsUrl": "https://landhearingsagenda.canyoncounty.id.gov/Landing",
    "sources": {
      "cases": "https://maps.canyonco.org/arcgisserver/rest/services/DSD/DSD_PLANNING_ZONING_APP_TRACKER/FeatureServer/0",
      "hearingsSchedule": "https://landhearingsagenda.canyoncounty.id.gov/Landing",
      "geometry": [
        "https://maps.canyonco.org/arcgisserver/rest/services/DSD/DSD_PLANNING_ZONING_APP_TRACKER/FeatureServer/0"
      ],
      "flum": "https://maps.canyonco.org/arcgisserver/rest/services/DSD/Future_Land_Use_2030_Adopted/MapServer/1",
      "agendas": "https://landhearingsagenda.canyoncounty.id.gov/Landing",
      "parcelFallback": "https://maps.canyonco.org/arcgisserver/rest/services/Assessor/CCPublicTaxparcels/MapServer/0"
    },
    "id": "canyon-county",
    "slug": "canyon-county",
    "name": "Canyon County",
    "type": "county",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#334155"
  },
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.4201,
      43.4918
    ],
    "boundaryLabel": "Official city limits",
    "boundarySources": [
      "https://services1.arcgis.com/WHM6qC35aMtyAAlN/ArcGIS/rest/services/CityLimitsAndImpactAreas/FeatureServer/1"
    ],
    "coverageNote": "City planning tracker and published hearings. A past hearing alone does not establish a final decision.",
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "P&Z",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "City Council",
        "label": "City Council",
        "shortLabel": "Council",
        "stageLabel": "Council hearing"
      }
    },
    "meetingRules": {
      "agendaNotice": "Agenda not posted yet; check the official meeting calendar",
      "location": "City Hall Council Chambers, 757 W 4th Street, Kuna, ID",
      "commentInstructions": "Use the city's published hearing notice for written comments and speaking instructions. Include the application number. Confirm deadlines with the published agenda."
    },
    "commentInstructionsUrl": "https://www.kunacity.id.gov/504/Public-Hearings-Definitions-Procedures",
    "sources": {
      "cases": "https://services2.arcgis.com/zGDMrUABi5rG1bng/arcgis/rest/services/Public_Hearing_Tracker_June_2025_View/FeatureServer/321",
      "hearingsSchedule": "https://www.kunacity.id.gov/93/Agendas-Minutes",
      "geometry": [
        "https://services2.arcgis.com/zGDMrUABi5rG1bng/arcgis/rest/services/Public_Hearing_Tracker_June_2025_View/FeatureServer/321"
      ],
      "flum": "https://services2.arcgis.com/zGDMrUABi5rG1bng/arcgis/rest/services/FLUM_FEB_2026/FeatureServer/1",
      "agendas": "https://www.kunacity.id.gov/93/Agendas-Minutes"
    },
    "id": "kuna",
    "slug": "kuna",
    "name": "Kuna",
    "type": "city",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#0f766e"
  },
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.4937,
      43.6921
    ],
    "boundaryLabel": "Official city limits",
    "boundarySources": [
      "https://services1.arcgis.com/WHM6qC35aMtyAAlN/ArcGIS/rest/services/CityLimitsAndImpactAreas/FeatureServer/1",
      "https://maps.canyonco.org/arcgisserver/rest/services/General/CITY_LIMITS_PUBLIC/FeatureServer/0"
    ],
    "coverageNote": "Initial coverage from published land-use hearings. Projects without a verified site boundary appear in All cases; this is not a complete application inventory.",
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "P&Z",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "City Council",
        "label": "City Council",
        "shortLabel": "Council",
        "stageLabel": "Council hearing"
      }
    },
    "meetingRules": {
      "agendaNotice": "Agenda not posted yet; check the official meeting calendar",
      "location": "City Hall, 10769 W State Street, Star, ID",
      "commentInstructions": "Use the city's published hearing notice for written comments and speaking instructions. Include the application number. Confirm deadlines with the published agenda."
    },
    "commentInstructionsUrl": "https://www.staridaho.org/1246/Public-Hearings",
    "sources": {
      "cases": "https://www.staridaho.org/1305/Meetings-Agendas",
      "hearingsSchedule": "https://meetings.municode.com/PublishPage/index?cid=STARID&ppid=13616671-3b4b-4eb5-bc0f-320059f14bbe&p=1",
      "geometry": [],
      "agendas": "https://meetings.municode.com/PublishPage/index?cid=STARID&ppid=13616671-3b4b-4eb5-bc0f-320059f14bbe&p=1"
    },
    "id": "star",
    "slug": "star",
    "name": "Star",
    "type": "city",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#db2777"
  },
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.6201,
      43.7068
    ],
    "boundaryLabel": "Official city limits",
    "boundarySources": [
      "https://maps.canyonco.org/arcgisserver/rest/services/General/CITY_LIMITS_PUBLIC/FeatureServer/0"
    ],
    "coverageNote": "Initial coverage from published land-use hearings. Projects without a verified site boundary appear in All cases; this is not a complete application inventory.",
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "P&Z",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "City Council",
        "label": "City Council",
        "shortLabel": "Council",
        "stageLabel": "Council hearing"
      }
    },
    "meetingRules": {
      "agendaNotice": "Agenda not posted yet; check the official meeting calendar",
      "location": "Council Chambers, 1103 W Main Street, Middleton, ID",
      "commentInstructions": "Use the city's published hearing notice for written comments and speaking instructions. Include the application number. Confirm deadlines with the published agenda."
    },
    "commentInstructionsUrl": "https://middleton.id.gov/public-hearing-notices",
    "sources": {
      "cases": "https://middleton.id.gov/public-hearing-notices",
      "hearingsSchedule": "https://middleton.id.gov/public-hearing-notices",
      "geometry": [],
      "agendas": "https://middleton.id.gov/public-hearing-notices"
    },
    "id": "middleton",
    "slug": "middleton",
    "name": "Middleton",
    "type": "city",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#7c3aed"
  },
  {
    "country": "us",
    "countryName": "United States",
    "stateName": "Idaho",
    "stateAbbreviation": "ID",
    "center": [
      -116.354,
      43.6954
    ],
    "boundaryLabel": "Official city limits",
    "boundarySources": [
      "https://services3.arcgis.com/kAacPsfz5gmRZ5sK/ArcGIS/rest/services/Eagle_City_Limits/FeatureServer/83"
    ],
    "coverageNote": "City planning tracker and published hearings. A past hearing alone does not establish a final decision.",
    "bodies": {
      "planning": {
        "id": "P&Z",
        "label": "Planning & Zoning Commission",
        "shortLabel": "P&Z",
        "stageLabel": "P&Z hearing"
      },
      "decision": {
        "id": "City Council",
        "label": "City Council",
        "shortLabel": "Council",
        "stageLabel": "Council hearing"
      },
      "additional": [
        {
          "id": "Design Review Board",
          "label": "Design Review Board",
          "shortLabel": "Design review",
          "stageLabel": "Design review"
        }
      ]
    },
    "meetingRules": {
      "agendaNotice": "Agenda not posted yet; check the official meeting calendar",
      "location": "Eagle City Hall, 660 E Civic Lane, Eagle, ID",
      "commentInstructions": "Use the city's published hearing notice for written comments and speaking instructions. Include the application number. Confirm deadlines with the published agenda."
    },
    "commentInstructionsUrl": "https://www.cityofeagle.org/2028/Public-Hearing-Notices",
    "sources": {
      "cases": "https://services3.arcgis.com/kAacPsfz5gmRZ5sK/arcgis/rest/services/Development_Tracker_Map_WFL1/FeatureServer/0",
      "hearingsSchedule": "https://eagle-id.granicus.com/ViewPublisher.php?view_id=1",
      "geometry": [
        "https://services3.arcgis.com/kAacPsfz5gmRZ5sK/arcgis/rest/services/Development_Tracker_Map_WFL1/FeatureServer/0"
      ],
      "flum": "https://services3.arcgis.com/kAacPsfz5gmRZ5sK/arcgis/rest/services/Future_Land_Use_Revised_2025/FeatureServer/105",
      "agendas": "https://eagle-id.granicus.com/ViewPublisher.php?view_id=1"
    },
    "id": "eagle",
    "slug": "eagle",
    "name": "Eagle",
    "type": "city",
    "state": "id",
    "status": "live",
    "timezone": "America/Denver",
    "color": "#0891b2"
  }
];
