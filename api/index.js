const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const cors = require('cors');
const app = express();
const port = 5000;
const axios = require('axios');
const mongoose =require("mongoose");
const User = require('../User');
const cryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
require("dotenv").config();
// Configure AWS SDK with your credentials
//sad
AWS.config.update({
  region: 'us-east-1', // Update with your desired AWS region
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
});

const route53 = new AWS.Route53();
app.use(cors());
app.use(bodyParser.json());



app.post("/login",async(req,res)=>{
  try {
   const user = await User.findOne({
       username:req.body.username
   });
   if(!user) 
    return res.status(401).json("no user Credentials");
   //console.log(user)
    const hashedPassword = cryptoJS.AES.decrypt(user.password,process.env.HASHEDPASSWORD);
   // console.log(hashedPassword)
   const Password = hashedPassword.toString(cryptoJS.enc.Utf8);
   console.log(Password);
  if(Password!==req.body.password)
  return  res.status(401).json("Wrong password Credentials");

  const accessToken = jwt.sign({
   id:user._id,
   isAdmin:user.isAdmin
  }, process.env.JWT,{expiresIn:"3d"});
  const {password, ...others} = user._doc;
    return res.status(200).json({...others,accessToken});

  } catch (error) {
   res.status(500).json(error.message);
  }
});



mongoose.connect(process.env.MONGO_URL).then(()=>{
  console.log("db connnected successfully");
}).catch((err)=>{
  console.log(err);
});



// const params = {
//   HostedZoneId: HostedZoneId, // Replace with your hosted zone ID
//   ChangeBatch: {
//     Changes: [
//           {
//             Action: 'UPSERT', // Options: CREATE, DELETE, UPSERT
//             ResourceRecordSet: {
//               Name: req.body.Name, // Replace with the DNS name to update
//               Type: req.body.Type, // DNS record type (A, CNAME, etc.)
//               TTL: req.body.TTL, // Time to live in seconds
//               ResourceRecords: req.body.val,
//             },
//           },
//         ],
//       },
//     };
app.post('/createBulkRecordSets', async (req, res) => {
  try {
    console.log(req.body)
    console.log(req.body.textareaValue);
    const hostZone = req.body.data;
    const spl = hostZone.split('/');
    const oldHost = spl[spl.length-1];
    const  recordSets  = req.body.textareaValue;
    const recordSetsArray = JSON.parse(recordSets);
    console.log(req.body);
    const changeBatch = {
      Changes: recordSetsArray.map(recordSet => ({
        Action: 'CREATE',
        ResourceRecordSet: recordSet,
      })),
    };

    const params = {
      HostedZoneId: oldHost, // Replace with your hosted zone ID
      ChangeBatch: changeBatch,
    };

    const response = await route53.changeResourceRecordSets(params).promise();

    res.json({ success: true, response });
  } catch (error) {
    console.error('Error creating record sets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});



app.post('/bulkCreateHostedZones', async (req, res) => {
    try {
      const { domainNames } = req.body;
      console.log(req.body)
      if(domainNames.includes(',')){
        const data = domainNames.split(',');

        for (const domainName of data) {
          const params = {
            Name: domainName,
            CallerReference: `create-hosted-zone-${Date.now()}`, // Unique reference for the request
          };
           await route53.createHostedZone(params).promise();  
        }
        return res.status(200).json({ success: true });
      }else{
        const params = {
          Name: domainNames,
          CallerReference: `create-hosted-zone-${Date.now()}`,} // Unique reference for the request
          const response = await route53.createHostedZone(params).promise();
          return res.status(200).json({ success: true });
        
      }
  
    } catch (error) {
      console.error('Error creating hosted zones:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });


app.get('/allhostedzones',async(req,res) =>{
  try {
   
    const params = {};

    const response = await route53.listHostedZones(params).promise();
    //const responses = [];
    if (response.HostedZones && response.HostedZones.length > 0) {
      
      res.status(200).json({ success: true,response });
    } else {
      console.log('No hosted zones found.');
      res.status(200).json({success:false},'No hosted zones found');
    }
  } catch (error) {
    console.error('Error listing hosted zones:', error);
    res.status(500).json({ success: false, error: error.message });
  }

});

app.post('/updatehostedzone',async(req,res)=>{
  try {
    const str = req.body.Id;
  const parts = str.split('/');
  console.log(parts)
  const oldHostedZoneId = parts[parts.length - 1];
  console.log(oldHostedZoneId)

  const hostedZone = await route53.getHostedZone({ Id: oldHostedZoneId }).promise();
  const newDomainName = req.body.Name;
  const oldDomainName = hostedZone.HostedZone.Name;
 // console.log(hostedZone.HostedZone.Name);
  if(hostedZone !== undefined){
    console.log(oldHostedZoneId)
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
     if (resourceRecordSets.length === 2 &&resourceRecordSets.filter(recordSet => ['NS', 'SOA'].includes(recordSet.Type))) {
      // Your code here
      const deleteZoneParams = {
        Id: oldHostedZoneId,
      };
      await route53.deleteHostedZone(deleteZoneParams).promise();

      console.log('Hosted zone domain updated successfully.');
    res.status(200).json({ success: true }); 
  } else {
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

    await  axios.post('https://dns-manager-tan.vercel.app/deletehostedzone',{hostedzone:oldHostedZoneId});

    
    console.log('Hosted zone domain updated successfully.');
    res.status(200).json({ success: true }); 
  //  return newHostedZoneId;

  }
   
  }else{
    res.status(300).json({ success: false},'data not found for given hostedZone' );

  }
  } catch (error) {
    console.error('Error updating hosted zones:', error);
    res.status(500).json({ success: false, error: error.message });
  }

})

app.post('/deletehostedzone',async(req,res)=>{
  try {
    console.log(req.body,'ajit')
    const hostedZoneId = req.body.hostedzone;

    // Step 1: List Resource Record Sets
    const listParams = {
      HostedZoneId: hostedZoneId,
    };
    const rrsets = await route53.listResourceRecordSets(listParams).promise();

    if (rrsets.ResourceRecordSets.length === 2 &&rrsets.ResourceRecordSets.filter(recordSet => ['NS', 'SOA'].includes(recordSet.Type))) {
      // Your code here
      const deleteZoneParams = {
        Id: hostedZoneId,
      };
      await route53.deleteHostedZone(deleteZoneParams).promise();

      console.log('Hosted zone domain updated successfully.');
  return   res.status(200).json({ success: true }); 
  }
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
    res.status(200).json({ success: true }); 
    console.log('Hosted zone deleted:', hostedZoneId);
  } catch (error) {
    console.error('Error deleting hosted zone:', error);
    res.status(500).json({ success: false, error: error.message });

  }


});

app.post('/gethostedzone',async (req,res)=>{
  try {
    // Get information about the hosted zone
    const hostedZoneId = req.body.hostedZone;
    
    const parts = hostedZoneId.split('/');
  
    const oldHostedZoneId = parts[parts.length - 1];
    const hostedZone = await route53.getHostedZone({ Id: oldHostedZoneId }).promise();
    console.log("Hosted Zone Info:");
    console.log(hostedZone);
      res.status(200).json({success:true,hostedZone})
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
    return res.status(500).json({success:false,err})
  }
});

app.post('/getrecordset',async (req,res)=>{
  try {
    const hostedZoneId = req.body.hostedZone;
    
    const parts = hostedZoneId.split('/');
  
    const oldHostedZoneId = parts[parts.length - 1];
    
    const recordSets = await route53.listResourceRecordSets({ HostedZoneId: oldHostedZoneId }).promise();
    console.log("DNS Records:");
    const data= recordSets.ResourceRecordSets;
    data.forEach((item, index) => {
      item.id = index + 1;
    });
    console.log(data);
    const response = data;
    return res.status(200).json({success:true,response}) 
  } catch (error) {
    return res.status(500).json({success:false,error})
  }
});


app.post('/creatednsrecord',async(req,res)=>{
  try {
    console.log(req.body);
    const oldHostedZoneId = req.body.val;
    const parts=   oldHostedZoneId.split('/');
    const HostedZoneId = parts[parts.length - 1];    
    const {Name,Type,TTL,ResourceRecords} = req.body.formData
    // {
    //   formData: { Name: 'asdas', Type: 'MX', TTL: '13', ResourceRecords: 'asd' },

    //   val: '/hostedzone/Z0900590C8RB1EOEQJWR'
    // }
    
    
    const params = {
      HostedZoneId: HostedZoneId, // Replace with your hosted zone ID
          ChangeBatch: {
            Changes: [
              {
                Action: 'CREATE', // Options: CREATE, DELETE, UPSERT
                ResourceRecordSet: {
                  Name: Name, // Replace with the DNS name to update
                  Type: Type, // DNS record type (A, CNAME, etc.)
                  TTL: TTL, // Time to live in seconds
                  ResourceRecords: [
                    { Value: ResourceRecords }, // Replace with the IP address or target
                  ],
                },
              },
            ],
          },
        };
        
        const response = await route53.changeResourceRecordSets(params).promise();
        
        return res.status(200).json({success:true,response}) 
  } catch (error) {
    return res.status(500).json({success:false,error})
  }
});

app.post('/updatednsrecord',async(req,res)=>{
  try {
    console.log(req.body);
    // {
    //   data: '/hostedzone/Z08595982XM4E5UOPMSPT',
    //   Name: 'done2.in.',
    //   Type: 'NS',
    //   TTL: 172800,
    //   val: [ { Value: 'hjkbafkas' }, { Value: 'bskdjfbjksd' } ]
    // }
    const oldHostedZoneId = req.body.data;
   const parts=   oldHostedZoneId.split('/');
   const HostedZoneId = parts[parts.length - 1];    
   console.log('hskla')
   if(req.body.Type === req.body.final.Type && req.body.Name === req.body.final.Name){

     
     const params = {
       HostedZoneId: HostedZoneId, // Replace with your hosted zone ID
       ChangeBatch: {
         Changes: [
           {
             Action: 'UPSERT', // Options: CREATE, DELETE, UPSERT
             ResourceRecordSet: {
               Name: req.body.Name, // Replace with the DNS name to update
               Type: req.body.Type, // DNS record type (A, CNAME, etc.)
               TTL: req.body.TTL, // Time to live in seconds
               ResourceRecords: req.body.val,
              },
            },
          ],
        },
      };
      const response=  await route53.changeResourceRecordSets(params).promise();
      
      return res.status(200).json({success:true,response}) 
   }else{

    const params = {
      HostedZoneId: HostedZoneId, // Replace with your hosted zone ID
      ChangeBatch: {
        Changes: [
          {
            Action: 'UPSERT', // Options: CREATE, DELETE, UPSERT
            ResourceRecordSet: {
              Name: req.body.Name, // Replace with the DNS name to update
              Type: req.body.Type, // DNS record type (A, CNAME, etc.)
              TTL: req.body.TTL, // Time to live in seconds
              ResourceRecords: req.body.val,
             },
           },
           {
             Action: 'DELETE', // Options: CREATE, DELETE, UPSERT
             ResourceRecordSet: {
               Name: req.body.final.Name, // Replace with the DNS name to update
               Type:  req.body.final.Type, // DNS record type (A, CNAME, etc.)
               TTL:  req.body.final.TTL, // Time to live in seconds
               ResourceRecords:  req.body.final.ResourceRecords,
             },
           },
         ],
       },
     };
     const response=  await route53.changeResourceRecordSets(params).promise();
      
     return res.status(200).json({success:true,response}) 
   }
    
    const response=  await route53.changeResourceRecordSets(params).promise();
      
        return res.status(200).json({success:true,response}) 
        
  } catch (error) {
    console.log(error);
    return res.status(500).json({success:false,error})
  }
});
app.post('/deleterecordset',async(req,res)=>{
try {
    console.log(req.body)
    const data=   JSON.parse(req.body.final);
    
    console.log(data.dataD);
    
    const {Name,Type,TTL,ResourceRecords} =data.dataD;
  const params = {
        HostedZoneId: data.hostedZone, // Replace with your hosted zone ID
        ChangeBatch: {
          Changes: [
            {
              Action: 'DELETE', // Options: CREATE, DELETE, UPSERT
              ResourceRecordSet: {
                Name: Name, // Replace with the DNS name to update
                Type: Type, // DNS record type (A, CNAME, etc.)
                TTL: TTL, // Time to live in seconds
                ResourceRecords: ResourceRecords,
              },
            },
          ],
        },
      };
      
      const response = await route53.changeResourceRecordSets(params).promise();
      
      
      return res.status(200).json({success:true,response}) 
    } catch (error) {
      return res.status(500).json({success:false,error})
    }
  });
  