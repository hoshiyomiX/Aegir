import { 
  PORTS, 
  PROTOCOLS, 
  PRX_BANK_URL, 
  KV_PRX_URL,
  MAX_CONFIGS_PER_REQUEST,
  CORS_HEADER_OPTIONS,
  SUB_PAGE_URL,
  PROTOCOL_V2,
  PROTOCOL_NEKO,
  CONVERTER_URL,
  PRX_HEALTH_CHECK_API
} from './config/constants.js';

import { 
  dnsCache, 
  pendingRequests, 
  coalesceStats,
  performGlobalCleanup,
  getMemorySummary
} from './core/state.js';

import { formatStats } from './core/diagnostics.js';
import { websocketHandler } from './handlers/websocket.js';
import { getKVPrxList, getPrxListPaginated } from './services/proxyProvider.js';
import { generateConfigsStream, createStreamingResponse } from './services/configGenerator.js';
import { reverseWeb } from './services/httpReverse.js';
import { prewarmDNS, cleanupDNSCache, fetchWithDNS } from './services/dns.js';

// Base64 Encoded WebUI v2.3 (With Fetch Logic & Proper UTF-8)
// FIXED: Typo "12px9" -> "12px;"
const BASE64_HTML = "PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImVuIj4KPGhlYWQ+CiAgICA8bWV0YSBjaGFyc2V0PSJVVEYtOCI+CiAgICA8bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEuMCI+CiAgICA8dGl0bGU+QWVnaXIgQ29uZmlnIHYyLjM8L3RpdGxlPgogICAgPCEtLSAKICAgICAgICBBZWdpciBXZWJVSSB2Mi4zCiAgICAgICAgPT09PT09PT09PT09PT09PQogICAgICAgIERldmVsb3BtZW50OiBFZGl0IHRoaXMgZmlsZSBmb3IgSFRNTCBzdHJ1Y3R1cmUgY2hhbmdlcwogICAgICAgIFByb2R1Y3Rpb246IFJ1biBgYnVuIHJ1biBidWlsZDp3ZWJ1aWAgdG8gaW5saW5lIENTUy9KUyBhbmQgZW5jb2RlIHRvIEJhc2U2NAogICAgICAgIAogICAgICAgIE5vdGU6IER1cmluZyBidWlsZCwgQ1NTIGFuZCBKUyBhcmUgaW5saW5lZCBkaXJlY3RseSBpbnRvIHRoaXMgZmlsZSwKICAgICAgICB0aGVuIHRoZSBlbnRpcmUgSFRNTCBpcyBlbmNvZGVkIGFzIEJhc2U2NCBmb3IgQ2xvdWRmbGFyZSBXb3JrZXJzLgogICAgLS0+CiAgICA8IS0tIENTUyB3aWxsIGJlIGlubGluZWQgaGVyZSBkdXJpbmcgYnVpbGQgLS0+CiAgICA8c3R5bGU+LyoqCiAqIEFlZ2lyIFdlYlVJIFN0eWxlcyB2Mi4zCiAqID09PT09PT09PT09PT09PT09PT09PT09CiAqIENsZWFuLCBtb2Rlcm4gZGFyayB0aGVtZSBmb3IgQWVnaXIgQ29uZmlnIEdlbmVyYXRvcgogKiAKICogVXNhZ2U6IEVkaXQgdGhpcyBmaWxlIGZvciBzdHlsaW5nIGNoYW5nZXMKICogQnVpbGQ6IFJ1biBgYnVuIHJ1biBidWlsZDp3ZWJ1aWAgdG8gZW5jb2RlIHRvIEJhc2U2NAogKi8KCi8qIENTUyBWYXJpYWJsZXMgLSBFYXN5IHRoZW1pbmcgKi8KOnJvb3QgewogIC0tcHJpbWFyeTogIzAwZjJlYTsKICAtLWJnOiAjMDUwNTA1OwogIC0tcGFuZWw6ICMxMTE7CiAgLS10ZXh0OiAjZWVlOwogIC0tYm9yZGVyOiAjMzMzOwp9CgovKiBSZXNldCAmIEJhc2UgKi8KKiB7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7IH0KCmJvZHkgewogIGJhY2tncm91bmQ6IHZhcigtLWJnKTsKICBjb2xvcjogdmFyKC0tdGV4dCk7CiAgZm9udC1mYW1pbHk6IC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmOwogIGRpc3BsYXk6IGZsZXg7CiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7CiAgYWxpZ24taXRlbXM6IGNlbnRlcjsKICBtaW4taGVpZ2h0OiAxMDB2aDsKICBtYXJnaW46IDA7CiAgcGFkZGluZzogMTVweDsKfQoKLyogQ2FyZCBDb250YWluZXIgKi8KLmNhcmQgewogIGJhY2tncm91bmQ6IHZhcigtLXBhbmVsKTsKICB3aWR0aDogMTAwJTsKICBtYXgtd2lkdGg6IDQyMHB4OwogIHBhZGRpbmc6IDI1cHg7CiAgYm9yZGVyLXJhZGl1czogMTJweDsKICBib3JkZXI6IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIpOwogIGJveC1zaGFkb3c6IDAgMTBweCA0MHB4IHJnYmEoMCwwLDAsMC42KTsKfQoKLyogVHlwb2dyYXBoeSAqLwpoMiB7CiAgdGV4dC1hbGlnbjogY2VudGVyOwogIG1hcmdpbjogMCAwIDIwcHg7CiAgY29sb3I6IHZhcigtLXByaW1hcnkpOwogIGZvbnQtd2VpZ2h0OiA4MDA7CiAgbGV0dGVyLXNwYWNpbmc6IDFweDsKfQoKaDIgc3BhbiB7CiAgZm9udC1zaXplOiAwLjRlbTsKICBjb2xvcjogIzY2NjsKICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlOwogIGJhY2tncm91bmQ6ICMyMjI7CiAgcGFkZGluZzogMnB4IDZweDsKICBib3JkZXItcmFkaXVzOiA0cHg7Cn0KCi8qIEZvcm0gR3JvdXBzICovCi5ncm91cCB7IG1hcmdpbi1ib3R0b206IDE1cHg7IH0KCmxhYmVsIHsKICBkaXNwbGF5OiBibG9jazsKICBtYXJnaW4tYm90dG9tOiA1cHg7CiAgZm9udC1zaXplOiAwLjc1cmVtOwogIGNvbG9yOiAjODg4OwogIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7CiAgZm9udC13ZWlnaHQ6IDcwMDsKICBsZXR0ZXItc3BhY2luZzogMC41cHg7Cn0KCi8qIEZvcm0gSW5wdXRzICovCmlucHV0LCBzZWxlY3QsIHRleHRhcmVhIHsKICB3aWR0aDogMTAwJTsKICBiYWNrZ3JvdW5kOiAjMDAwOwogIGJvcmRlcjogMXB4IHNvbGlkICMyYTJhMmE7CiAgY29sb3I6ICNmZmY7CiAgcGFkZGluZzogMTBweDsKICBib3JkZXItcmFkaXVzOiA2cHg7CiAgZm9udC1zaXplOiAxNHB4OwogIHRyYW5zaXRpb246IGJvcmRlciAwLjJzOwp9CgppbnB1dDpmb2N1cywgc2VsZWN0OmZvY3VzIHsKICBib3JkZXItY29sb3I6IHZhcigtLXByaW1hcnkpOwogIG91dGxpbmU6IG5vbmU7Cn0KCi8qIFByaW1hcnkgQnV0dG9uICovCmJ1dHRvbiB7CiAgd2lkdGg6IDEwMCU7CiAgYmFja2dyb3VuZDogdmFyKC0tcHJpbWFyeSk7CiAgY29sb3I6ICMwMDA7CiAgZm9udC13ZWlnaHQ6IDgwMDsKICBib3JkZXI6IG5vbmU7CiAgcGFkZGluZzogMTJweDsKICBib3JkZXItcmFkaXVzOiA2cHg7CiAgY3Vyc29yOiBwb2ludGVyOwogIHRleHQtdHJhbnNmb3JtOiB1cHBlcmNhc2U7CiAgbGV0dGVyLXNwYWNpbmc6IDFweDsKICBtYXJnaW4tdG9wOiAxMHB4OwogIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yczsKfQoKYnV0dG9uOmhvdmVyIHsgb3BhY2l0eTogMC45OyB9CmJ1dHRvbjpkaXNhYmxlZCB7IG9wYWNpdHk6IDAuNTsgY3Vyc29yOiBub3QtYWxsb3dlZDsgfQoKLyogUmVzdWx0IEFyZWEgKi8KI3Jlc3VsdC1hcmVhIHsKICBtYXJnaW4tdG9wOiAyMHB4OwogIGRpc3BsYXk6IG5vbmU7CiAgYW5pbWF0aW9uOiBmYWRlSW4gMC4zcyBlYXNlOwp9Cgp0ZXh0YXJlYSB7CiAgaGVpZ2h0OiAxMjBweDsKICBmb250LWZhbWlseTogbW9ub3NwYWNlOwogIGZvbnQtc2l6ZTogMTJweDsKICBsaW5lLWhlaWdodDogMS40OwogIGNvbG9yOiAjYTVmM2ZjOwogIHJlc2l6ZTogdmVydGljYWw7CiAgYm9yZGVyLWNvbG9yOiAjMzMzOwp9CgovKiBBY3Rpb24gQnV0dG9ucyBHcmlkICovCi5hY3Rpb25zIHsKICBkaXNwbGF5OiBncmlkOwogIGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyIDFmcjsKICBnYXA6IDEwcHg7CiAgbWFyZ2luLXRvcDogNXB4Owp9Cgouc2VjLWJ0biB7CiAgYmFja2dyb3VuZDogIzIyMjsKICBjb2xvcjogI2ZmZjsKICBmb250LXdlaWdodDogNjAwOwogIGZvbnQtc2l6ZTogMTJweDsKfQoKLnNlYy1idG46aG92ZXIgeyBiYWNrZ3JvdW5kOiAjMzMzOyB9CgovKiBBbmltYXRpb25zICovCkBrZXlmcmFtZXMgZmFkZUluIHsKICBmcm9tIHsgb3BhY2l0eTogMDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDVweCk7IH0KICB0byB7IG9wYWNpdHk6IDE7IHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTsgfQp9CgovKiBFcnJvciBNZXNzYWdlICovCi5lcnJvci1tc2cgewogIGNvbG9yOiAjZmY0NDQ0OwogIGZvbnQtc2l6ZTogMTJweDsKICBtYXJnaW4tdG9wOiAxMHB4OwogIHRleHQtYWxpZ246IGNlbnRlcjsKICBkaXNwbGF5OiBub25lOwp9Cjwvc3R5bGU+CjwvaGVhZD4KPGJvZHk+CiAgICA8ZGl2IGNsYXNzPSJjYXJkIj4KICAgICAgICA8aDI+QWVnaXIg8J+MiiA8c3Bhbj52Mi4zPC9zcGFuPjwvaDI+CgogICAgICAgIDxkaXYgY2xhc3M9Imdyb3VwIj4KICAgICAgICAgICAgPGxhYmVsPkJ1ZyBJUCAvIFNlcnZlciBBZGRyZXNzPC9sYWJlbD4KICAgICAgICAgICAgPGlucHV0IGlkPSJidWciIHR5cGU9InRleHQiIHBsYWNlaG9sZGVyPSJlLmcuIDEwNC4xNi54Lnggb3IgY2RuLmRvbWFpbi5jb20iPgogICAgICAgIDwvZGl2PgoKICAgICAgICA8ZGl2IGNsYXNzPSJncm91cCI+CiAgICAgICAgICAgIDxsYWJlbD5TTkkgLyBXZWJTb2NrZXQgSG9zdDwvbGFiZWw+CiAgICAgICAgICAgIDxpbnB1dCBpZD0ic25pIiB0eXBlPSJ0ZXh0IiBwbGFjZWhvbGRlcj0iQXV0by1kZXRlY3QgKFdvcmtlciBIb3N0KSI+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6IGdyaWQ7IGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyIDFmcjsgZ2FwOiAxMHB4OyI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imdyb3VwIj4KICAgICAgICAgICAgICAgIDxsYWJlbD5Db3VudHJ5IChDQyk8L2xhYmVsPgogICAgICAgICAgICAgICAgPGlucHV0IGlkPSJjYyIgdHlwZT0idGV4dCIgcGxhY2Vob2xkZXI9IlNHLElEIj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imdyb3VwIj4KICAgICAgICAgICAgICAgIDxsYWJlbD5MaW1pdDwvbGFiZWw+CiAgICAgICAgICAgICAgICA8c2VsZWN0IGlkPSJsaW1pdCI+CiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0iMSI+U2luZ2xlPC9vcHRpb24+CiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT0iMTAiPkxpc3QgKDEwKTwvb3B0aW9uPgogICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9IjUwIiBzZWxlY3RlZD5CdWxrICg1MCk8L29wdGlvbj4KICAgICAgICAgICAgICAgIDwvc2VsZWN0PgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KCiAgICAgICAgPGRpdiBjbGFzcz0iZ3JvdXAiPgogICAgICAgICAgICA8bGFiZWw+T3V0cHV0IEZvcm1hdDwvbGFiZWw+CiAgICAgICAgICAgIDxzZWxlY3QgaWQ9ImZtdCI+CiAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPSJyYXciPlJhdyBVUkkgKFZMRVNTL1Ryb2phbik8L29wdGlvbj4KICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9InYycmF5Ij5WMlJheSAvIFhyYXkgKEJhc2U2NCk8L29wdGlvbj4KICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9ImNsYXNoIj5DbGFzaCBQcm92aWRlciAoWUFNTCk8L29wdGlvbj4KICAgICAgICAgICAgPC9zZWxlY3Q+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxidXR0b24gaWQ9Im1haW4tYnRuIiBvbmNsaWNrPSJydW4oKSI+R2VuZXJhdGUgJiBGZXRjaCBDb25maWc8L2J1dHRvbj4KICAgICAgICA8ZGl2IGlkPSJlcnJvciIgY2xhc3M9ImVycm9yLW1zZyI+PC9kaXY+CgogICAgICAgIDxkaXYgaWQ9InJlc3VsdC1hcmVhIj4KICAgICAgICAgICAgPGxhYmVsPlJlc3VsdCBDb250ZW50PC9sYWJlbD4KICAgICAgICAgICAgPHRleHRhcmVhIGlkPSJvdXRwdXQiIHJlYWRvbmx5IG9uY2xpY2s9InRoaXMuc2VsZWN0KCkiPjwvdGV4dGFyZWE+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImFjdGlvbnMiPgogICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0ic2VjLWJ0biIgb25jbGljaz0iY29weSgpIj5Db3B5IEFsbDwvYnV0dG9uPgogICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz0ic2VjLWJ0biIgb25jbGljaz0ib3BlblVybCgpIj5PcGVuIExpbms8L2J1dHRvbj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KCiAgICA8IS0tIEphdmFTY3JpcHQgd2lsbCBiZSBpbmxpbmVkIGhlcmUgZHVyaW5nIGJ1aWxkIC0tPgogICAgPHNjcmlwdD4vKioKICogQWVnaXIgV2ViVUkgSmF2YVNjcmlwdCB2Mi4zCiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PQogKiBIYW5kbGVzIGZvcm0gc3VibWlzc2lvbiwgQVBJIGNhbGxzLCBhbmQgVUkgaW50ZXJhY3Rpb25zCiAqIAogKiBVc2FnZTogRWRpdCB0aGlzIGZpbGUgZm9yIGxvZ2ljIGNoYW5nZXMKICogQnVpbGQ6IFJ1biBgYnVuIHJ1biBidWlsZDp3ZWJ1aWAgdG8gZW5jb2RlIHRvIEJhc2U2NAogKi8KCi8vIFBsYWNlaG9sZGVyIGxvZ2ljIC0gc2V0IGRlZmF1bHQgdmFsdWVzIGJhc2VkIG9uIGN1cnJlbnQgaG9zdApjb25zdCBob3N0ID0gbG9jYXRpb24uaG9zdG5hbWU7CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidWcnKS5wbGFjZWhvbGRlciA9IGhvc3Q7CmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzbmknKS5wbGFjZWhvbGRlciA9IGhvc3Q7CgovKioKICogTWFpbiBmdW5jdGlvbiB0byBnZW5lcmF0ZSBhbmQgZmV0Y2ggY29uZmlnCiAqIFZhbGlkYXRlcyBpbnB1dCwgYnVpbGRzIFVSTCwgZmV0Y2hlcyBmcm9tIEFQSSwgZGlzcGxheXMgcmVzdWx0CiAqLwphc3luYyBmdW5jdGlvbiBydW4oKSB7CiAgICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFpbi1idG4nKTsKICAgIGNvbnN0IGVyckRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdlcnJvcicpOwogICAgY29uc3QgcmVzRGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3VsdC1hcmVhJyk7CiAgICBjb25zdCBvdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3V0cHV0Jyk7CgogICAgLy8gUmVzZXQgc3RhdGUKICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7CiAgICBidG4uaW5uZXJUZXh0ID0gIlByb2Nlc3NpbmcuLi4iOwogICAgZXJyRGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7CiAgICByZXNEaXYuc3R5bGUuZGlzcGxheSA9ICdub25lJzsKICAgIG91dC52YWx1ZSA9ICcnOwoKICAgIHRyeSB7CiAgICAgICAgLy8gQnVpbGQgVVJMIGZyb20gZm9ybSBpbnB1dHMKICAgICAgICBjb25zdCBidWcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnVnJykudmFsdWUudHJpbSgpOwogICAgICAgIGNvbnN0IHNuaSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzbmknKS52YWx1ZS50cmltKCk7CiAgICAgICAgY29uc3QgY2MgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2MnKS52YWx1ZS50cmltKCk7CiAgICAgICAgY29uc3QgbGltaXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGltaXQnKS52YWx1ZTsKICAgICAgICBjb25zdCBmbXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZm10JykudmFsdWU7CgogICAgICAgIC8vIEJ1aWxkIHF1ZXJ5IHBhcmFtZXRlcnMKICAgICAgICBjb25zdCBwID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpOwogICAgICAgIGlmIChidWcpIHAuYXBwZW5kKCdkb21haW4nLCBidWcpOwogICAgICAgIGlmIChzbmkpIHAuYXBwZW5kKCdzbmknLCBzbmkpOwogICAgICAgIGlmIChjYykgcC5hcHBlbmQoJ2NjJywgY2MudG9VcHBlckNhc2UoKSk7CiAgICAgICAgcC5hcHBlbmQoJ2xpbWl0JywgbGltaXQpOwoKICAgICAgICAvLyBEZXRlcm1pbmUgQVBJIHBhdGggYmFzZWQgb24gZm9ybWF0CiAgICAgICAgbGV0IHBhdGggPSAnL2FwaS92MS9zdWInOwogICAgICAgIGlmIChmbXQgPT09ICdjbGFzaCcpIHsKICAgICAgICAgICAgcGF0aCA9ICcvc3ViJzsKICAgICAgICAgICAgcC5hcHBlbmQoJ2Zvcm1hdCcsICdjbGFzaCcpOwogICAgICAgICAgICBpZiAoc25pKSBwLmFwcGVuZCgnaG9zdCcsIHNuaSk7CiAgICAgICAgfSBlbHNlIHsKICAgICAgICAgICAgcC5hcHBlbmQoJ2Zvcm1hdCcsIGZtdCk7CiAgICAgICAgfQoKICAgICAgICBjb25zdCB0YXJnZXRVcmwgPSBsb2NhdGlvbi5vcmlnaW4gKyBwYXRoICsgJz8nICsgcC50b1N0cmluZygpOwoKICAgICAgICAvLyBGZXRjaCBjb250ZW50IHdpdGggdGltZW91dAogICAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7CiAgICAgICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiBjb250cm9sbGVyLmFib3J0KCksIDE1MDAwKTsgLy8gMTVzIHRpbWVvdXQKCiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godGFyZ2V0VXJsLCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7CiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7CgogICAgICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYEhUVFAgJHtyZXMuc3RhdHVzfWApOwoKICAgICAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzLnRleHQoKTsKCiAgICAgICAgLy8gU2hvdyByZXN1bHQKICAgICAgICBvdXQudmFsdWUgPSB0ZXh0OwogICAgICAgIHJlc0Rpdi5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJzsKICAgICAgICB3aW5kb3cuZ2VuZXJhdGVkVXJsID0gdGFyZ2V0VXJsOyAvLyBTdG9yZSBmb3IgIk9wZW4gTGluayIgYnV0dG9uCgogICAgfSBjYXRjaCAoZSkgewogICAgICAgIGVyckRpdi5pbm5lclRleHQgPSBlLm5hbWUgPT09ICdBYm9ydEVycm9yJyAKICAgICAgICAgICAgPyAnVGltZW91dDogU2VydmVyIHRvb2sgdG9vIGxvbmcnIAogICAgICAgICAgICA6ICdFcnJvcjogJyArIGUubWVzc2FnZTsKICAgICAgICBlcnJEaXYuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7CiAgICB9IGZpbmFsbHkgewogICAgICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlOwogICAgICAgIGJ0bi5pbm5lclRleHQgPSAiR2VuZXJhdGUgJiBGZXRjaCBDb25maWciOwogICAgfQp9CgovKioKICogQ29weSByZXN1bHQgdG8gY2xpcGJvYXJkCiAqLwpmdW5jdGlvbiBjb3B5KCkgewogICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3V0cHV0Jyk7CiAgICBlbC5zZWxlY3QoKTsKICAgIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGVsLnZhbHVlKTsKICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb25zIGJ1dHRvbicpOwogICAgY29uc3Qgb2xkID0gYnRuLmlubmVyVGV4dDsKICAgIGJ0bi5pbm5lclRleHQgPSAiQ29waWVkISI7CiAgICBzZXRUaW1lb3V0KCgpID0+IGJ0bi5pbm5lclRleHQgPSBvbGQsIDE1MDApOwp9CgovKioKICogT3BlbiBnZW5lcmF0ZWQgVVJMIGluIG5ldyB0YWIKICovCmZ1bmN0aW9uIG9wZW5VcmwoKSB7CiAgICBpZiAod2luZG93LmdlbmVyYXRlZFVybCkgewogICAgICAgIHdpbmRvdy5vcGVuKHdpbmRvdy5nZW5lcmF0ZWRVcmwsICdfYmxhbmsnKTsKICAgIH0KfQo8L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==";

// CRITICAL FIX: Pre-decode HTML at module load time (decode once, use forever)
// This avoids decoding on every request and uses more efficient Uint8Array.from
const cachedHtml = (() => {
  try {
    const binary = atob(BASE64_HTML);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    console.error("Failed to decode HTML at module load:", err);
    return "<html><body><h1>Error loading UI</h1></body></html>";
  }
})();

// Getter function for backward compatibility
function getDecodedHtml() {
  return cachedHtml;
}

// ============ REQUEST DEDUPLICATION (FIXED) ============

// Constants for deduplication
const DEDUP_TTL_MS = 2000; // Time-to-live for pending request entries
const DEDUP_MAX_SIZE = 100; // Maximum pending requests

/**
 * Generates a unique key for request deduplication
 * @param {Request} request - The incoming request
 * @returns {string} - Unique request key
 */
function getRequestKey(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const paramKeys = ['offset', 'limit', 'cc', 'port', 'vpn', 'format', 'domain', 'prx-list', 'sni', 'host'];
  for (const key of paramKeys) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }
  return url.pathname + '?' + params.toString();
}

/**
 * Request deduplication with proper cleanup
 * CRITICAL FIX: Removed setTimeout, using explicit cleanup instead
 * CRITICAL FIX v2: Handle streaming responses properly with tee()
 * 
 * @param {Request} request - The incoming request
 * @param {Function} handler - The request handler function
 * @returns {Promise<Response>} - The response
 */
async function deduplicateRequest(request, handler) {
  // Only deduplicate GET requests
  if (request.method !== 'GET') {
    return handler();
  }

  const requestKey = getRequestKey(request);
  
  // Check if there's already a pending request for this key
  if (pendingRequests.has(requestKey)) {
    const pendingEntry = pendingRequests.get(requestKey);
    
    // CRITICAL FIX: Check if the entry is still valid (not expired)
    if (pendingEntry && Date.now() - pendingEntry.timestamp < DEDUP_TTL_MS) {
      coalesceStats.hits++;
      coalesceStats.saved++;
      try {
        const result = await pendingEntry.promise;
        
        // CRITICAL FIX: Handle streaming responses properly
        // Use tee() to create two identical streams
        if (result.body) {
          const [stream1, stream2] = result.body.tee();
          // Replace the original body with one stream
          const originalResponse = new Response(stream1, result);
          // Return the other stream to the waiting client
          return new Response(stream2, originalResponse);
        }
        
        // For non-streaming responses, clone is safe
        return result.clone();
      } catch (err) {
        // If the pending promise rejects, remove it and try again
        pendingRequests.delete(requestKey);
        // Fall through to create new request
      }
    } else {
      // Entry expired, remove it
      pendingRequests.delete(requestKey);
    }
  }

  // Check size limit and remove oldest if needed
  if (pendingRequests.size >= DEDUP_MAX_SIZE) {
    // Find and remove the oldest entry
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of pendingRequests.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      pendingRequests.delete(oldestKey);
    }
  }

  coalesceStats.misses++;

  // Create the promise for this request
  const timestamp = Date.now();
  let resolvePromise;
  let rejectPromise;
  
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  // Store the pending request with timestamp
  pendingRequests.set(requestKey, { promise, timestamp });

  try {
    // Execute the handler
    const response = await handler();
    
    // Resolve the promise for any waiting consumers
    resolvePromise(response);
    
    // Schedule cleanup using request context (if available) or direct cleanup
    // Note: We don't use setTimeout as it's unreliable in Workers
    // Instead, we clean up on next request or via periodic cleanup
    
    return response;
  } catch (err) {
    // On error, remove from pending and reject
    pendingRequests.delete(requestKey);
    rejectPromise(err);
    throw err;
  } finally {
    // CRITICAL FIX: Clean up after response is sent
    // Use a microtask to ensure response is sent first
    Promise.resolve().then(() => {
      // Only delete if it's still our entry (not replaced by another request)
      const entry = pendingRequests.get(requestKey);
      if (entry && entry.timestamp === timestamp) {
        pendingRequests.delete(requestKey);
      }
    });
  }
}

// ============ CACHING HELPERS ============

function getCacheKey(request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const paramKeys = ['offset', 'limit', 'cc', 'port', 'vpn', 'format', 'domain', 'prx-list', 'sni', 'host'];
  for (const key of paramKeys) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const cacheUrl = new URL(url.origin + url.pathname);
  cacheUrl.search = params.toString();
  return new Request(cacheUrl.toString(), { method: 'GET', headers: request.headers });
}

async function handleCachedRequest(request, handler) {
  if (request.method !== 'GET') return handler();
  
  const cache = caches.default;
  const cacheKey = getCacheKey(request);
  
  // Try cache first
  let response = await cache.match(cacheKey);
  if (response) {
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Cache-Status', 'HIT');
    return newResponse;
  }
  
  // No cache hit, execute handler
  response = await handler();
  
  // Cache successful responses with Cache-Control header
  if (response.status === 200 && response.headers.has('Cache-Control')) {
    try {
      const responseToCache = response.clone();
      await cache.put(cacheKey, responseToCache);
    } catch (cacheErr) {
      // Cache put can fail, don't let it break the response
      console.error("Cache put error:", cacheErr);
    }
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Cache-Status', 'MISS');
    return newResponse;
  }
  
  return response;
}

// ============ HEALTH CHECK ============

async function checkPrxHealth(prxIP, prxPort) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const req = await fetchWithDNS(`${PRX_HEALTH_CHECK_API}?ip=${prxIP}:${prxPort}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return await req.json();
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message || "Health check failed" };
  }
}

// ============ CACHE HEADERS ============

function addCacheHeaders(headers, ttl = 3600, browserTTL = 1800) {
  headers["Cache-Control"] = `public, max-age=${browserTTL}, s-maxage=${ttl}, stale-while-revalidate=86400`;
  headers["CDN-Cache-Control"] = `public, max-age=${ttl}`;
  headers["Cloudflare-CDN-Cache-Control"] = `max-age=${ttl}`;
  headers["Vary"] = "Accept-Encoding";
  headers["ETag"] = `"${Date.now().toString(36)}"`;
}

// ============ MAIN EXPORT ============

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const appDomain = url.hostname;
      const serviceName = appDomain.split(".")[0];

      // CRITICAL FIX: Perform global cleanup periodically using ctx.waitUntil
      // This ensures cleanup happens in background without blocking response
      if (Math.random() < 0.05) { // 5% chance per request
        ctx.waitUntil(Promise.resolve().then(performGlobalCleanup));
      }

      // Pre-warm DNS cache on cold start
      if (dnsCache && dnsCache.size === 0) {
        ctx.waitUntil(prewarmDNS());
      }

      // Periodic DNS cache cleanup
      if (Math.random() < 0.1) {
        ctx.waitUntil(Promise.resolve().then(cleanupDNSCache));
      }

      // Handle WebSocket upgrade
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader === "websocket") {
        const prxMatch = url.pathname.match(/^\/(.+[:=-]\d+)$/);
        let prxIP = "";
        
        if (url.pathname.length === 3 || url.pathname.match(",")) {
          const prxKeys = url.pathname.replace("/", "").toUpperCase().split(",");
          const prxKey = prxKeys[Math.floor(Math.random() * prxKeys.length)];
          const kvPrx = await getKVPrxList(KV_PRX_URL, env);
          if (kvPrx && kvPrx[prxKey]) {
            prxIP = kvPrx[prxKey][Math.floor(Math.random() * kvPrx[prxKey].length)];
          }
          return await websocketHandler(request, prxIP);
        } else if (prxMatch) {
          prxIP = prxMatch[1];
          return await websocketHandler(request, prxIP);
        }
      }

      // ============ ROUTING LOGIC ============

      // Serve WebUI (CRITICAL FIX: Use cached HTML)
      if (url.pathname === "/" || url.pathname === "/sub") {
        const html = getDecodedHtml();
        return new Response(html, { 
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
      } 
      
      // Health check endpoint
      else if (url.pathname.startsWith("/check")) {
        const target = url.searchParams.get("target")?.split(":") || [];
        if (target.length < 1) {
          return new Response(JSON.stringify({ error: "Invalid target" }), { 
            status: 400,
            headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "application/json" }
          });
        }
        
        const resultPromise = checkPrxHealth(target[0], target[1] || "443");
        const result = await Promise.race([
          resultPromise,
          new Promise((resolve) => setTimeout(() => resolve({ error: "Health check timeout" }), 5000)),
        ]);
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 
            ...CORS_HEADER_OPTIONS, 
            "Content-Type": "application/json", 
            "Cache-Control": "public, max-age=300" 
          },
        });
      } 
      
      // API endpoints
      else if (url.pathname.startsWith("/api/v1")) {
        const apiPath = url.pathname.replace("/api/v1", "");
        
        if (apiPath.startsWith("/sub")) {
          return deduplicateRequest(request, () => {
            return handleCachedRequest(request, async () => {
              // Parse and validate parameters
              const offset = Math.max(0, parseInt(url.searchParams.get("offset")) || 0);
              const filterCC = url.searchParams.get("cc")?.toUpperCase().split(",").filter(Boolean) || [];
              const filterPort = url.searchParams.get("port")?.split(",").map(p => parseInt(p)).filter(p => p > 0 && p < 65536) || PORTS;
              const filterVPN = url.searchParams.get("vpn")?.split(",").filter(Boolean) || PROTOCOLS;
              const filterLimit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit")) || MAX_CONFIGS_PER_REQUEST), MAX_CONFIGS_PER_REQUEST);
              const filterFormat = url.searchParams.get("format") || "raw";
              
              const fillerDomain = url.searchParams.get("domain") || appDomain;
              const customSNI = url.searchParams.get("sni") || url.searchParams.get("host") || appDomain;
              const prxBankUrl = url.searchParams.get("prx-list") || env.PRX_BANK_URL || PRX_BANK_URL;
              
              const { data: prxList, pagination } = await getPrxListPaginated(prxBankUrl, { offset, limit: filterLimit, filterCC }, env);
              const uuid = crypto.randomUUID();
              const ssUsername = btoa(`none:${uuid}`);
              const stats = formatStats();
              
              const responseHeaders = {
                ...CORS_HEADER_OPTIONS,
                "X-Pagination-Offset": offset.toString(),
                "X-Pagination-Limit": filterLimit.toString(),
                "X-Pagination-Total": pagination.total.toString(),
                "X-Pagination-Has-More": pagination.hasMore.toString(),
                "X-Pool-Stats": stats.pool,
                "X-Buffer-Stats": stats.buffer,
                "X-Timeout-Stats": stats.timeout,
                "X-Retry-Stats": stats.retry,
                "X-Batch-Stats": stats.batch,
                "X-Dedup-Stats": stats.dedup,
                "X-Streaming-Stats": stats.streaming,
                "X-DNS-Stats": stats.dns,
                "X-Worker-Optimizations": "OPT11-18-ACTIVE-FIXED",
              };

              if (pagination.nextOffset !== null) {
                responseHeaders["X-Pagination-Next-Offset"] = pagination.nextOffset.toString();
              }

              if (filterFormat === "raw") {
                responseHeaders["Content-Type"] = "text/plain; charset=utf-8";
                responseHeaders["X-Streaming-Mode"] = "ACTIVE";
                addCacheHeaders(responseHeaders, 3600, 1800);
                const configStream = generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, customSNI, serviceName);
                return createStreamingResponse(configStream, responseHeaders, filterFormat);
                
              } else if (filterFormat === PROTOCOL_V2) {
                const result = [];
                const configStream = generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, customSNI, serviceName);
                for await (const config of configStream) result.push(config);
                const finalResult = btoa(result.join("\n"));
                responseHeaders["Content-Type"] = "text/plain; charset=utf-8";
                responseHeaders["X-Streaming-Mode"] = "BUFFERED";
                addCacheHeaders(responseHeaders, 3600, 1800);
                return new Response(finalResult, { status: 200, headers: responseHeaders });
                
              } else {
                // Converter format
                const result = [];
                const configStream = generateConfigsStream(prxList, filterPort, filterVPN, filterLimit, fillerDomain, uuid, ssUsername, customSNI, serviceName);
                for await (const config of configStream) result.push(config);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                try {
                  const res = await fetchWithDNS(CONVERTER_URL, {
                    method: "POST",
                    body: JSON.stringify({ url: result.join(","), format: filterFormat, template: "cf" }),
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);
                  
                  if (res.ok) {
                    const finalResult = await res.text();
                    responseHeaders["Content-Type"] = res.headers.get("Content-Type") || "text/plain; charset=utf-8";
                    responseHeaders["X-Streaming-Mode"] = "CONVERTER";
                    addCacheHeaders(responseHeaders, 3600, 1800);
                    return new Response(finalResult, { status: 200, headers: responseHeaders });
                  } else {
                    return new Response(JSON.stringify({ error: "Converter service error" }), { 
                      status: 502, 
                      headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "application/json" }
                    });
                  }
                } catch (converterErr) {
                  clearTimeout(timeoutId);
                  return new Response(JSON.stringify({ error: "Converter service timeout or unavailable" }), { 
                    status: 504, 
                    headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "application/json" }
                  });
                }
              }
            });
          });
          
        } else if (apiPath.startsWith("/myip")) {
          return new Response(JSON.stringify({
            ip: request.headers.get("cf-connecting-ipv6") || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip"),
            colo: request.headers.get("cf-ray")?.split("-")[1],
            ...request.cf,
          }), { 
            headers: { 
              ...CORS_HEADER_OPTIONS, 
              "Content-Type": "application/json", 
              "Cache-Control": "private, max-age=60" 
            } 
          });
        } else if (apiPath.startsWith("/metrics")) {
          // Health metrics endpoint for monitoring
          const stats = formatStats();
          const memory = getMemorySummary();
          return new Response(JSON.stringify({
            version: "2.0.0",
            timestamp: new Date().toISOString(),
            memory,
            stats: {
              pool: stats.pool,
              buffer: stats.buffer,
              timeout: stats.timeout,
              retry: stats.retry,
              batch: stats.batch,
              dedup: stats.dedup,
              streaming: stats.streaming,
              dns: stats.dns
            },
            cf: {
              colo: request.headers.get("cf-ray")?.split("-")[1],
              country: request.cf?.country,
              asn: request.cf?.asn
            }
          }, null, 2), {
            headers: {
              ...CORS_HEADER_OPTIONS,
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=10"
            }
          });
        }
      }

      // Default: Reverse Proxy for unknown paths
      const targetReversePrx = env.REVERSE_PRX_TARGET || "example.com";
      return await reverseWeb(request, targetReversePrx);
      
    } catch (err) {
      console.error("Worker error:", err);
      return new Response(`An error occurred: ${err.toString()}`, { 
        status: 500, 
        headers: { ...CORS_HEADER_OPTIONS, "Content-Type": "text/plain; charset=utf-8" } 
      });
    }
  },
};
