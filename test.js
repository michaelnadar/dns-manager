const AWS = require('aws-sdk');
const { Route53Client, ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
// Configure the SDK to use the appropriate region and credentials
AWS.config.update({ region: 'us-east-1' });

// Create a Route 53 client
const route53 = new AWS.Route53();

// AWS.config.update({
//   region: 'us-east-1',
//   accessKeyId: 'YOUR_ACCESS_KEY_ID',
//   secretAccessKey: 'YOUR_SECRET_ACCESS_KEY'
// });
const getHostedZoneInfo = async (hostedZoneId) => {
  try {
    // Get information about the hosted zone
    const hostedZone = await route53.getHostedZone({ Id: hostedZoneId }).promise();
    console.log("Hosted Zone Info:");
    console.log(hostedZone);

    // Get all record sets associated with the hosted zone
    // const recordSets = await route53.listResourceRecordSets({ HostedZoneId: hostedZoneId }).promise();
    // console.log("DNS Records:");
    // console.log(recordSets.ResourceRecordSets);
    // const don= recordSets.ResourceRecordSets;
    // don.forEach(element => {
    //   console.log(element.ResourceRecords);
    // });
  } catch (err) {
    console.error("Error:", err.message);
  }
};

// Replace with your hosted zone ID
const hostedZoneId = 'Z007641033AHQNK3TZBLS';




// Call the function



const updateDNSRecord = async () => {
  try {
    const params = {
      HostedZoneId: 'Z0535664I80C018H7M4', // Replace with your hosted zone ID
      ChangeBatch: {
        Changes: [
              {
                Action: 'UPSERT', // Options: CREATE, DELETE, UPSERT
                ResourceRecordSet: {
                  Name: 'dummytest.com', // Replace with the DNS name to update
                  Type: 'AAAA', // DNS record type (A, CNAME, etc.)
                  TTL: 300, // Time to live in seconds
                  ResourceRecords: [
                    { Value: '2001:0db8:85a3::8a2e:0370:7334' }, // Replace with the IP address or target
                  ],
                },
              },
            ],
          },
        };
        
        const response = await route53.changeResourceRecordSets(params).promise();
        
        console.log('DNS Record Updated:', response);
      } catch (error) {
        console.error('Error updating DNS record:', error);
      }
};

const createDNSRecord = async () => {
  try {
    const params = {
      HostedZoneId: 'Z0535664I80C018H7M4', // Replace with your hosted zone ID
          ChangeBatch: {
            Changes: [
              {
                Action: 'CREATE', // Options: CREATE, DELETE, UPSERT
                ResourceRecordSet: {
                  Name: 'dummytest.com', // Replace with the DNS name to update
                  Type: 'CNAME', // DNS record type (A, CNAME, etc.)
                  TTL: 300, // Time to live in seconds
                  ResourceRecords: [
                    { Value: 'your-target-domain.com' }, // Replace with the IP address or target
                  ],
                },
              },
            ],
          },
        };
        
        const response = await route53.changeResourceRecordSets(params).promise();
        
        console.log('DNS Record Updated:', response);
      } catch (error) {
        console.error('Error updating DNS record:', error);
      }
    };
const deleteDNSRecord = async () => {
  try {
    const params = {
          HostedZoneId: 'Z0535664I80C018H7M4', // Replace with your hosted zone ID
          ChangeBatch: {
            Changes: [
              {
                Action: 'DELETE', // Options: CREATE, DELETE, UPSERT
                ResourceRecordSet: {
                  Name: 'dummytest.com', // Replace with the DNS name to update
                  Type: 'AAAA', // DNS record type (A, CNAME, etc.)
                  TTL: 300, // Time to live in seconds
                  ResourceRecords: [
                    { Value: '2001:0db8:85a3::8a2e:0370:7334' }, // Replace with the IP address or target
                  ],
                },
              },
            ],
          },
        };
        
        const response = await route53.changeResourceRecordSets(params).promise();
        
        console.log('DNS Record Updated:', response);
      } catch (error) {
        console.error('Error updating DNS record:', error);
      }
    };
    
const listHostedZones = async () => {
  try {
    const route53 = new AWS.Route53();
    
    const params = {};

    const response = await route53.listHostedZones(params).promise();
    
    if (response.HostedZones && response.HostedZones.length > 0) {
      console.log('Hosted Zones:');
      response.HostedZones.forEach((hostedZone) => {
        console.log(hostedZone);
        //console.log(`- ${hostedZone.Name} (ID: ${hostedZone.Id})`);
      });
    } else {
      console.log('No hosted zones found.');
    }
  } catch (error) {
    console.error('Error listing hosted zones:', error);
  }
};


const createHostedZone = async (domainName) => {
  try {
    const route53 = new AWS.Route53();
    
    const params = {
      Name: domainName,
      CallerReference: `create-hosted-zone-${Date.now()}`, // Unique reference for the request
    };
    
    const response = await route53.createHostedZone(params).promise();
    
    console.log('Hosted zone created:', response.HostedZone.Id);
  } catch (error) {
    console.error('Error creating hosted zone:', error);
  }
};


const updateHostedZoneDomain = async (oldHostedZoneId, oldDomainName, newDomainName) => {
  try {
    const route53 = new AWS.Route53();

    // Create a new hosted zone with the new domain name
    const newHostedZoneParams = {
      Name: newDomainName,
      CallerReference: `create-hosted-zone-${Date.now()}`, // Unique reference for the request
    };
    const newHostedZoneResponse = await route53.createHostedZone(newHostedZoneParams).promise();
    const newHostedZoneId = newHostedZoneResponse.HostedZone.Id;

    // Retrieve the records from the old hosted zone
    const listResourceRecordSetsParams = {
      HostedZoneId: oldHostedZoneId,
    };
    const listResourceRecordSetsResponse = await route53.listResourceRecordSets(listResourceRecordSetsParams).promise();
    const resourceRecordSets = listResourceRecordSetsResponse.ResourceRecordSets;

    // Exclude NS and SOA records from the migration process
    const recordsToMigrate = resourceRecordSets.filter(recordSet => !['NS', 'SOA'].includes(recordSet.Type));

    // Change the domain name for each record and create it in the new hosted zone
    const changeBatch = {
      Changes: recordsToMigrate.map(recordSet => ({
        Action: 'CREATE',
        ResourceRecordSet: {
          Name: recordSet.Name.replace(oldDomainName, newDomainName),
          Type: recordSet.Type,
          TTL: recordSet.TTL,
          ResourceRecords: recordSet.ResourceRecords,
        },
      })),
    };
    const changeResourceRecordSetsParams = {
      HostedZoneId: newHostedZoneId,
      ChangeBatch: changeBatch,
    };
    await route53.changeResourceRecordSets(changeResourceRecordSetsParams).promise();

    // Optionally, delete the old hosted zone after migrating the records
    // await route53.deleteHostedZone({ Id: oldHostedZoneId }).promise();

    console.log('Hosted zone domain updated successfully.');
    return newHostedZoneId;
  } catch (error) {
    console.error('Error updating hosted zone domain:', error);
    throw error;
  }
};



const deleteHostedZone = async (hostedZoneId) => {
  try {
    const route53 = new AWS.Route53();

    // Step 1: List Resource Record Sets
    const listParams = {
      HostedZoneId: hostedZoneId,
    };
    const rrsets = await route53.listResourceRecordSets(listParams).promise();

    // Step 2: Filter out NS and SOA records
    const nonRequiredRRsets = rrsets.ResourceRecordSets.filter(rrset => {
      return rrset.Type !== 'NS' && rrset.Type !== 'SOA';
    });

    // Step 3: Prepare changes for the change batch
    const changes = nonRequiredRRsets.map(rrset => ({
      Action: 'DELETE',
      ResourceRecordSet: {
        Name: rrset.Name,
        Type: rrset.Type,
        TTL: rrset.TTL,
        ResourceRecords: rrset.ResourceRecords,
      },
    }));

    // Step 4: Delete Resource Record Sets
    const changeParams = {
      ChangeBatch: {
        Changes: changes,
      },
      HostedZoneId: hostedZoneId,
    };

    await route53.changeResourceRecordSets(changeParams).promise();

    // Step 5: Delete Hosted Zone
    const deleteZoneParams = {
      Id: hostedZoneId,
    };
    await route53.deleteHostedZone(deleteZoneParams).promise();

    console.log('Hosted zone deleted:', hostedZoneId);
  } catch (error) {
    console.error('Error deleting hosted zone:', error);
  }
};




//deleteHostedZone('Z008206517H8F3IUD4MEW');


//updateHostedZoneDomain('Z09214512K7VU8OW35YGM', 'michealajit.in', 'michealajit.live');


// Example usage:
//createHostedZone('exampletest.com');


//listHostedZones();



// Call the function
//deleteDNSRecord();
//updateDNSRecord();
//createDNSRecord();
getHostedZoneInfo('Z09658572D3PK6SM451Y8');
// 2001:0db8:85a3::8a2e:0370:7334 --- AAAA
// 127.0.0.1 ----A
// 10 mail.example.com.  ----MX
// 10 5 5060 michealajit.in. --- SRV
// v=spf1 ip4:192.168.0.1/16-all --- SPF
// 10 100 "S" "SIP+D2U" "" foo.example.com. ---- NAPTR
// 0 issue "ca.example.com" ---- CAA
// (InvalidChangeBatch 400: RRSet of type DS with DNS name dummytest.com. is not permitted in zone dummytest.com.) -----DS