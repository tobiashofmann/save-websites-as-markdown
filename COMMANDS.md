# List of commands

## URLs

Sample URL:

https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/48ba073157b85295e10000000a42189b.html

Sample RAP documentation URL:

https://help.sap.com/docs/ABAP_PLATFORM_NEW/fc4c71aa50014fd1b43721701471913d/289477a81eec4d4e84c0302fb6835035.html?locale=en-US

Base path in URL: 

/docs/ABAP_PLATFORM_NEW/fc4c71aa50014fd1b43721701471913d

## Crawl links

### Scripts

Static websites. wget can be used. get-links.sh is using wget for accessing the web site.

```sh
chmod +x get-links.sh
./get-links.sh https://www.abapconf.org/abapconf2025
```

#### Extract both hyperlinks and resource URLs, deduplicated

```sh
./get-links.sh -a href,src -u https://www.abapconf.org/abapconf2025
```

#### Same-domain links only

```sh
./get-links.sh -S -u -a href,src https://www.abapconf.org/abapconf2025
```

#### Only PDF

```sh
./get-links.sh -a href -u -r '\.pdf($|\?)' https://www.abapconf.org/abapconf2025
```

#### Exclude images

```sh
./get-links.sh -a href,src -u -x '\.(png|jpg|jpeg|gif|svg)($|\?)' https://www.abapconf.org/abapconf2025
```

#### “Discover” links via spider mode (1 hop)

```sh
./get-links.sh --spider -l 1 -u https://www.abapconf.org/abapconf2025
```

### Does not work with JavaScript sites

SAP Help

```sh
./get-links.sh https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/48ba073157b85295e10000000a42189b.html
```

## Playwright

```sh
node crawl.js "https://example.com/doc/" "/doc" "links.txt"
```

For the SAP Help page for topic ABAP Platform

```sh
node crawl.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/48ba073157b85295e10000000a42189b.html" "/ABAP_PLATFORM_NEW" "links.txt"
```

### Other examples

#### RAP Docu

```sh
node crawl.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/fc4c71aa50014fd1b43721701471913d/289477a81eec4d4e84c0302fb6835035.html?locale=en-US" "/docs/ABAP_PLATFORM_NEW/fc4c71aa50014fd1b43721701471913d" "links.txt"
```

#### ADT Docu

```sh
node crawl.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/c238d694b825421f940829321ffa326a/4b190c90ceba4d02a99e0a2286b89358.html?locale=en-US" "/docs/ABAP_PLATFORM_NEW/c238d694b825421f940829321ffa326a" "links_adt.txt"
```

#### Fiori Launchpad

```sh
node crawl.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/a7b390faab1140c087b8926571e942b7/f951b50a07ce41deb08ced62711fe8b5.html?locale=en-US" "/docs/ABAP_PLATFORM_NEW/a7b390faab1140c087b8926571e942b7" "links_flp.txt"
```

#### CDS

```sh
node crawl.js "https://help.sap.com/docs/abap-cloud/abap-data-models/abap-data-models?locale=en-US" "/docs/abap-cloud/abap-data-models" "links_abapcloud.txt"
```

#### SAP Fiori Overview

```sh
node crawl.js "https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/22bbe89ef68b4d0e98d05f0d56a7f6c8/4c1048feb4ea4f7d81ccbc47233a0d68.html?locale=en-US" "/docs/SAP_S4HANA_ON-PREMISE/22bbe89ef68b4d0e98d05f0d56a7f6c8" "links_fiori_overview.txt"
```

#### SAP UI5

```sh
node crawl.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/468a97775123488ab3345a0c48cadd8f/95d113be50ae40d5b0b562b84d715227.html?locale=en-US" "/docs/ABAP_PLATFORM_NEW/468a97775123488ab3345a0c48cadd8f" "links_sapui5.txt"
```

#### ABAP Platform

```sh
node crawl.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/adc7d5717257421989b37d4d78f315ec.html?locale=en-US" "/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/" "links_abap_platform.txt"
```

## Save as Markdown

Download first, then convert to md

### Static website

```sh
wget -O page.html "https://www.abapconf.org/abapconf2025"
pandoc page.html -f html -t markdown -o page.md
```

Download as html and convert to md in one try

```sh
wget -qO- "https://www.abapconf.org/abapconf2025" | pandoc -f html -t markdown -o page.md
```

Download as html and convert to md in one try, with html2text

```sh
wget -qO- "https://www.abapconf.org/abapconf2025" | html2text -width=100 > page.md
```

```sh
wget -qO- "https://www.abapconf.org/abapconf2025" | html2text -width=100 > page.md
```

### Download with playwright and convert to md with pandoc

```sh
node render.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/a7b390faab1140c087b8926571e942b7/2ba4364043964befbe1b52ae0a721427.html?locale=en-US" page.rendered.html
pandoc page.rendered.html -f html -t markdown -o page.md
```

## HTML to MD

```sh
node save-page-md.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/48ba073157b85295e10000000a42189b.html?locale=en-US" "page.md"
```

```sh
node save-page-div-as-md.js "https://help.sap.com/docs/ABAP_PLATFORM_NEW/b5670aaaa2364a29935f40b16499972d/48ba073157b85295e10000000a42189b.html?locale=en-US" "./out"
```

## Crawl

Take as input a list of links from a txt file and save the MD files to a folder.

```sh
node save-page-md.js links_rap.txt rap
node save-page-md.js links_adt.txt adt
node save-page-md.js links_flp.txt flp
node save-page-md.js links_abapcloud.txt cds
```

## Clean up markdown

```sh
perl -0777 -pe 's/<!--.*?-->//gs; s/\n{3,}/\n\n/g' *.md > gesamt.md
```