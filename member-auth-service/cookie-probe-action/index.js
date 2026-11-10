// Isolated gateway probe; no credentials or auth code. Array-valued response
// headers are intentionally experimental and are not assumed to be supported.
exports.main = function main() {
  return {statusCode:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','Set-Cookie':['kits_probe_a=1; Path=/; Secure; HttpOnly; SameSite=Lax','kits_probe_b=2; Path=/; Secure; HttpOnly; SameSite=Lax']},body:'Synthetic cookie transport probe'};
};
