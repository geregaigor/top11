using Microsoft.Extensions.FileProviders;
using Vite.AspNetCore.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddViteServices(options =>
{
    options.Server.AutoRun = true;
});


var app = builder.Build();

app.UseHttpsRedirection();

if (!app.Environment.IsDevelopment())
{
    var webRootProvider = new PhysicalFileProvider(Path.Combine(builder.Environment.ContentRootPath, "wwwroot"));
    var distProvider = new PhysicalFileProvider(Path.Combine(builder.Environment.ContentRootPath, "dist"));
    var compositeProvider = new CompositeFileProvider(webRootProvider, distProvider);
    app.Environment.WebRootFileProvider = compositeProvider;
    app.Environment.WebRootPath = distProvider.Root;
}
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseViteDevelopmentServer();
}

app.MapRazorPages();
app.MapFallbackToPage("/index");

app.Run();
