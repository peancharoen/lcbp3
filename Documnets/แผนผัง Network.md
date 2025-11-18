# **🗺️ แผนผัง Network Architecture & Firewall (LCBP3-DMS)**

แผนผังนี้แสดงการแบ่งส่วนเครือข่าย (VLANs) และกฎ Firewall (ACLs) สำหรับ TP-Link Omada (ER7206/OC200) เพื่อรักษาความปลอดภัยของ QNAP NAS และ Docker Services

## **1\. แผนผังการเชื่อมต่อ (Connection Flow Diagram)**

graph TD  
    direction TB

    subgraph Flow1 \[\<b\>การเชื่อมต่อจากภายนอก (Public WAN)\</b\>\]  
        User\[ผู้ใช้งานภายนอก (Internet)\]  
    end

    subgraph Router \[\<b\>Router (ER7206)\</b\> \- Gateway\]  
        User \-- "Port 80/443 (HTTPS/HTTP)" \--\> ER7206  
        ER7206(\<b\>Port Forwarding\</b\>\<br/\>TCP 80 \-\> 192.168.10.100:80\<br/\>TCP 443 \-\> 192.168.10.100:443)  
    end

    subgraph VLANs \[\<b\>เครือข่ายภายใน (VLANs & Firewall Rules)\</b\>\]  
        direction LR

        subgraph VLAN10 \[\<b\>VLAN 10: Servers (DMZ)\</b\>\<br/\>192.168.10.x\]  
            QNAP\[\<b\>QNAP NAS (192.168.10.100)\</b\>\]  
        end  
          
        subgraph VLAN20 \[\<b\>VLAN 20: Office\</b\>\<br/\>192.168.20.x\]  
            OfficePC\[PC พนักงาน/Wi-Fi\]  
        end

        subgraph VLAN30 \[\<b\>VLAN 30: Guests\</b\>\<br/\>192.168.30.x\]  
            GuestPC\[Guest Wi-Fi\]  
        end

        subgraph Firewall \[\<b\>Firewall ACLs (ควบคุมโดย OC200)\</b\>\]  
            direction TB  
            rule1(\<b\>Rule 1: DENY\</b\>\<br/\>Guest (VLAN 30\) \-\> All VLANs)  
            rule2(\<b\>Rule 2: DENY\</b\>\<br/\>Server (VLAN 10\) \-\> Office (VLAN 20))  
            rule3(\<b\>Rule 3: ALLOW\</b\>\<br/\>Office (VLAN 20\) \-\> QNAP (192.168.10.100)\<br/\>Ports: 443, 80, 81, 2222\)  
        end

        %% \--- แสดงผล Firewall Rules \---  
        GuestPC \-.x|rule1| QNAP  
        QNAP \-.x|rule2| OfficePC  
        OfficePC \-- "\[https://lcbp3.np-dms.work\](https://lcbp3.np-dms.work)" \--\>|rule3| QNAP  
    end

    %% \--- เชื่อมต่อ Router กับ QNAP \---  
    ER7206 \--\> QNAP

    subgraph Docker \[\<b\>Docker Network 'lcbp3' (ภายใน QNAP)\</b\>\]  
        direction TB  
          
        subgraph PublicServices \[Services ที่ NPM เปิดสู่ภายนอก\]  
            direction LR  
            NPM\[\<b\>NPM (Nginx Proxy Manager)\</b\>\<br/\>รับการจราจรจาก QNAP\]  
            Frontend(frontend:3000)  
            Backend(backend:3000)  
            Gitea(gitea:3000)  
            PMA(pma:80)  
            N8N(n8n:5678)  
        end

        subgraph InternalServices \[Internal Services (Backend เรียกใช้เท่านั้น)\]  
            direction LR  
            DB(mariadb:3306)  
            Cache(cache:6379)  
            Search(search:9200)  
        end

        %% \--- การเชื่อมต่อภายใน Docker \---  
        NPM \-- "lcbp3.np-dms.work" \--\> Frontend  
        NPM \-- "backend.np-dms.work" \--\> Backend  
        NPM \-- "git.np-dms.work" \--\> Gitea  
        NPM \-- "pma.np-dms.work" \--\> PMA  
        NPM \-- "n8n.np-dms.work" \--\> N8N

        Backend \-- "lcbp3 Network" \--\> DB  
        Backend \-- "lcbp3 Network" \--\> Cache  
        Backend \-- "lcbp3 Network" \--\> Search  
          
    end  
      
    %% \--- เชื่อมต่อ QNAP กับ Docker \---  
    QNAP \--\> NPM

    %% \--- Styling \---  
    classDef default fill:\#f9f9f9,stroke:\#333,stroke-width:2px;  
    classDef router fill:\#e6f7ff,stroke:\#0056b3,stroke-width:2px;  
    classDef vlan fill:\#fffbe6,stroke:\#d46b08,stroke-width:2px;  
    classDef docker fill:\#e6ffed,stroke:\#096dd9,stroke-width:2px;  
    classDef internal fill:\#f0f0f0,stroke:\#595959,stroke-width:2px,stroke-dasharray: 5 5;  
    classDef fw fill:\#fff0f0,stroke:\#d9363e,stroke-width:2px,stroke-dasharray: 3 3;

    class Router,ER7206 router;  
    class VLANs,VLAN10,VLAN20,VLAN30 vlan;  
    class Docker,PublicServices,InternalServices docker;  
    class DB,Cache,Search internal;  
    class Firewall,rule1,rule2,rule3 fw;

## **2\. สรุปการตั้งค่า Firewall ACLs (สำหรับ Omada OC200)**

นี่คือรายการกฎ (Rules) ที่คุณต้องสร้างใน Settings \> Network Security \> ACL (เรียงลำดับจากบนลงล่าง):

| ลำดับ | Name | Policy | Source | Destination | Ports |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **1** | Isolate-Guests | **Deny** | Network \-\> VLAN 30 (Guests) | Network \-\> VLAN 1, 10, 20 | All |
| **2** | Isolate-Servers | **Deny** | Network \-\> VLAN 10 (Servers) | Network \-\> VLAN 20 (Office) | All |
| **3** | Block-Office-to-Mgmt | **Deny** | Network \-\> VLAN 20 (Office) | Network \-\> VLAN 1 (Mgmt) | All |
| **4** | Allow-Office-to-Services | **Allow** | Network \-\> VLAN 20 (Office) | IP Group \-\> QNAP\_Services (192.168.10.100) | Port Group \-\> Web\_Services (443, 80, 81, 2222\) |
| **5** | (Default) | Allow | Any | Any | All |

## **3\. สรุปการตั้งค่า Port Forwarding (สำหรับ Omada ER7206)**

นี่คือรายการกฎที่คุณต้องสร้างใน Settings \> Transmission \> Port Forwarding:

| Name | External Port | Internal IP | Internal Port | Protocol |
| :---- | :---- | :---- | :---- | :---- |
| Allow-NPM-HTTPS | 443 | 192.168.10.100 | 443 | TCP |
| Allow-NPM-HTTP | 80 | 192.168.10.100 | 80 | TCP |

