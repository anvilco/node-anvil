const path = require('path')
const Anvil = require('../../src/index')
const argv = require('yargs')
  .usage('Usage: $0 apiKey employeeEmailAddress employerEmailAddress')
  .demandCommand(3).argv

// This example will create a signature packet with 2 PDFs:
// * An IRS W-4 template is specified and filled with employee data
// * A demo NDA PDF is uploaded, then filled with employee and employer data
//
// Then both the employee and employer will sign the PDFs:
// * The employee signs first on both the IRS W-4 and the NDA
// * The employer signs second (after the employee is finished)
//   and only signs the NDA
//
// Both signers will get emails when it is their turn to sign, then you (as the
// Anvil organization admin) will get an email when it is all completed.
//
// See https://esign-demo.useanvil.com for a live example

// The API key from your Anvil organization settings
const apiKey = argv._[0]

// Signer emails. Make sure these are valid email addresses
const employeeEmail = argv._[1]
const employerEmail = argv._[2]

// You shouldn't need to update these...
const employeeName = 'Sally Employee'
const employerName = 'Bill AcmeManager'
const irsW4Eid = 'XnuTZKVZg1Mljsu999od'

async function main () {
  const anvilClient = new Anvil({ apiKey })
  const ndaFile = Anvil.prepareGraphQLFile(path.join(__dirname, '../static/test-pdf-nda.pdf'))
  const variables = getPacketVariables(ndaFile)
  const { data: result } = await anvilClient.createEtchPacket({ variables })
  const { data, errors } = result
  if (errors) {
    console.log('Error', errors)
  } else {
    console.log(data.createEtchPacket)
  }
}

function getPacketVariables (ndaFile) {
  return {
    // Indicate the packet is all ready to send to the
    // signers. An email will be sent to the first signer.
    isDraft: false,

    // Test packets will use development signatures and
    // not count toward your billed packets
    isTest: true,

    // Subject & body of the emails to signers
    name: `HR Docs - ${employeeName}`,
    signatureEmailSubject: 'HR Documents ok',
    signatureEmailBody: 'Please sign these HR documents....',

    files: [
      {
        // Our ID we will use to reference and fill it with data.
        // It can be any string you want!
        id: 'templatePdfIrsW4',

        // The id to the ready-made W-4 template. Fields and their ids are
        // specified when building out the template
        castEid: irsW4Eid,
      },
      {
        // This is a file we will upload and specify the fields ourselves
        id: 'fileUploadNDA',
        title: 'Demo NDA',
        file: ndaFile, // The file to be uploaded
        fields: [
          {
            id: 'effectiveDate',
            type: 'date',
            rect: { x: 326, y: 92, height: 12, width: 112 },
            format: 'MM/DD/YYYY',
            pageNum: 0,
          },
          {
            id: 'disclosingPartyName',
            type: 'fullName',
            rect: { x: 215, y: 107, height: 12, width: 140 },
            pageNum: 0,
          },
          {
            id: 'disclosingPartyEmail',
            type: 'email',
            rect: { x: 360, y: 107, height: 12, width: 166 },
            pageNum: 0,
          },
          {
            id: 'recipientName',
            type: 'fullName',
            rect: { x: 223, y: 120, height: 12, width: 140 },
            pageNum: 0,
          },
          {
            id: 'recipientEmail',
            type: 'email',
            rect: { x: 367, y: 120, height: 12, width: 166 },
            pageNum: 0,
          },
          {
            id: 'purposeOfBusiness',
            type: 'shortText',
            rect: { x: 314, y: 155, height: 12, width: 229 },
            pageNum: 0,
          },
          {
            id: 'placeOfGovernance',
            type: 'shortText',
            rect: { x: 237, y: 236, height: 12, width: 112 },
            pageNum: 1,
          },
          {
            id: 'recipientSignatureName',
            type: 'fullName',
            rect: { x: 107, y: 374, height: 22, width: 157 },
            pageNum: 1,
          },
          {
            id: 'recipientSignature',
            type: 'signature',
            rect: { x: 270, y: 374, height: 22, width: 142 },
            pageNum: 1,
          },
          {
            id: 'recipientSignatureDate',
            type: 'signatureDate',
            rect: { x: 419, y: 374, height: 22, width: 80 },
            pageNum: 1,
          },
          {
            id: 'disclosingPartySignatureName',
            type: 'fullName',
            rect: { x: 107, y: 416, height: 22, width: 159 },
            pageNum: 1,
          },
          {
            id: 'disclosingPartySignature',
            type: 'signature',
            rect: { x: 272, y: 415, height: 22, width: 138 },
            pageNum: 1,
          },
          {
            id: 'disclosingPartySignatureDate',
            type: 'signatureDate',
            rect: { x: 418, y: 414, height: 22, width: 82 },
            pageNum: 1,
          },
        ],
      },
    ],

    data: {
      // This data will fill the PDF before it's sent to any signers.
      // IDs here were set up on each field while templatizing the PDF.
      payloads: {
        // 'templatePdfIrsW4' is the W-4 file ID specified above
        templatePdfIrsW4: {
          data: {
            name: employeeName,
            ssn: '456454567',
            filingStatus: 'Joint',
            address: {
              street1: '123 Main St #234',
              city: 'San Francisco',
              state: 'CA',
              zip: '94106',
              country: 'US',
            },
            employerEin: '897654321',
            employerAddress: {
              street1: '555 Market St',
              city: 'San Francisco',
              state: 'CA',
              zip: '94103',
              country: 'US',
            },
          },
        },

        // 'fileUploadNDA' is the NDA's file ID specified above
        fileUploadNDA: {
          fontSize: 8,
          textColor: '#0000CC',
          data: {
            // The IDs here match the fields we created in the
            // files property above
            effectiveDate: '2024-01-30',
            recipientName: employeeName,
            recipientSignatureName: employeeName,
            recipientEmail: employeeEmail,

            disclosingPartyName: 'Acme Co.',
            disclosingPartySignatureName: employerName,
            disclosingPartyEmail: employerEmail,

            purposeOfBusiness: 'DEMO!!',
            placeOfGovernance: 'The Land',
          },
        },
      },
    },

    signers: [
      // Signers will sign in the order they are specified in this array.
      // e.g. `employer` will sign after `employee` has finished signing
      {
        // `employee` is the first signer
        id: 'employee',
        name: employeeName,
        email: employeeEmail,

        // These fields will be presented when this signer signs.
        // The signer will will need to click through the signatures in
        // the order of this array.
        fields: [
          {
            // File IDs are specified in the `files` property above
            fileId: 'templatePdfIrsW4',
            fieldId: 'employeeSignature',
          },
          {
            fileId: 'templatePdfIrsW4',
            fieldId: 'employeeSignatureDate',
          },
          {
            fileId: 'fileUploadNDA',
            // NDA field IDs are specified in the `files[].fields` property above
            fieldId: 'recipientSignature',
          },
          {
            fileId: 'fileUploadNDA',
            fieldId: 'recipientSignatureDate',
          },
        ],
      },
      {
        // `employer` is the 2nd signer
        id: 'employer',
        name: employerName,
        email: employerEmail,
        fields: [
          {
            fileId: 'fileUploadNDA',
            fieldId: 'disclosingPartySignature',
          },
          {
            fileId: 'fileUploadNDA',
            fieldId: 'disclosingPartySignatureDate',
          },
        ],
      },
    ],
  }
}

function run (fn) {
  fn().then(() => {
    process.exit(0)
  }).catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
}

run(main)
