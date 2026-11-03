using System.Reflection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Top11.Web.Infrastructure
{
	public interface IEndpoint
	{
		void MapEndpoint(IEndpointRouteBuilder app);
	}

	public static class EndpointsExtensions
	{
		public static IServiceCollection AddApiEndpoints(
			this IServiceCollection services,
			Assembly assembly)
		{
			ServiceDescriptor[] serviceDescriptors = assembly
				.DefinedTypes
				.Where(type => type is { IsAbstract: false, IsInterface: false } &&
							   type.IsAssignableTo(typeof(IEndpoint)))
				.Select(type => ServiceDescriptor.Transient(typeof(IEndpoint), type))
				.ToArray();

			services.TryAddEnumerable(serviceDescriptors);

			return services;
		}

		public static IApplicationBuilder MapEndpoints(
			this WebApplication app)
		{
			IEnumerable<IEndpoint> endpoints = app.Services
				.GetRequiredService<IEnumerable<IEndpoint>>();

			foreach (IEndpoint endpoint in endpoints)
			{
				endpoint.MapEndpoint(app);
			}

			return app;
		}
	}
}
