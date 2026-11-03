using System.Reflection;
using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Top11.Web.Database;
using Top11.Web.Infrastructure;
using Vite.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var settings = builder.Configuration.Get<AppSettings>() ?? throw new ApplicationException("Failed to get AppSettings");

builder.Services.AddRazorPages();
builder.Services.AddViteServices(options => { options.Server.AutoRun = true; options.Server.PackageDirectory = "ClientApp"; });

builder.Services.AddMediatR(configuration => configuration.RegisterServicesFromAssemblyContaining<Program>());
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddApiEndpoints(Assembly.GetExecutingAssembly());
builder.Services.AddTop11CookieAuthentication(settings);

builder.Services.AddDbContext<Top11DbContext>(options => options.UseSqlServer(settings.ConnectionStrings.Top11));
builder.Services.AddDataProtection()
	.SetApplicationName("Top11")
	.PersistKeysToDbContext<Top11DbContext>();

builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
//builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();
app.ApplyMigrations();
app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseMiddleware<ValidationExceptionHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapEndpoints();

if (app.Environment.IsDevelopment())
{
	app.UseWebSockets();
	app.UseViteDevelopmentServer(true);
}
else
{
	app.MapFallbackToFile("index.html");
}

app.Run();
